import { randomUUID } from "node:crypto";
import { APP_POLICY } from "./policy.js";

const events = [];
let nextSequence = 1;
const ALLOWED_EVENT_TYPES = new Set([
  "discovery_requested",
  "discovery_completed",
  "tool_call",
  "request_rejected",
  "request_failed",
  "rate_limited",
  "client_disconnect",
]);

export function createRequestId() {
  return `od-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
}

export function attachRequestId(request, response, next) {
  request.requestId = createRequestId();
  response.setHeader("X-Request-ID", request.requestId);
  next();
}

export function recordAuditEvent({
  eventType,
  requestId = "",
  toolName = "",
  outcome = "",
  statusCode = 0,
  durationMs = 0,
  count = 0,
} = {}) {
  if (!ALLOWED_EVENT_TYPES.has(eventType)) return null;
  const event = Object.freeze({
    sequence: nextSequence++,
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    eventType,
    requestId: String(requestId).slice(0, 64),
    ...(toolName ? { toolName: String(toolName).slice(0, 40) } : {}),
    ...(outcome ? { outcome: String(outcome).slice(0, 32) } : {}),
    ...(Number.isInteger(statusCode) && statusCode > 0 ? { statusCode } : {}),
    ...(Number.isFinite(durationMs) && durationMs >= 0 ? { durationMs: Math.round(durationMs) } : {}),
    ...(Number.isInteger(count) && count > 0 ? { count } : {}),
  });
  events.push(event);
  if (events.length > APP_POLICY.auditBufferSize) events.shift();
  console.info(JSON.stringify({ level: "info", subsystem: "audit", ...event }));
  return event;
}

export function getRecentAuditEvents(limit = 100) {
  const safeLimit = Math.max(1, Math.min(200, Number.isInteger(limit) ? limit : 100));
  return events.slice(-safeLimit).reverse();
}

export function createRateLimiter({
  windowMs = APP_POLICY.discoveryRateLimit.windowMs,
  maxRequests = APP_POLICY.discoveryRateLimit.maxRequests,
  keyForRequest = request => request.socket?.remoteAddress || "unknown",
  now = Date.now,
} = {}) {
  const windows = new Map();
  return function rateLimit(request, response, next) {
    const currentTime = now();
    const key = String(keyForRequest(request) || "unknown").slice(0, 128);
    let state = windows.get(key);
    if (!state || currentTime - state.startedAt >= windowMs) {
      state = { startedAt: currentTime, count: 0 };
      windows.set(key, state);
    }
    state.count += 1;
    response.setHeader("RateLimit-Limit", String(maxRequests));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, maxRequests - state.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil((state.startedAt + windowMs) / 1000)));
    if (state.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((state.startedAt + windowMs - currentTime) / 1000));
      response.setHeader("Retry-After", String(retryAfter));
      recordAuditEvent({
        eventType: "rate_limited",
        requestId: request.requestId,
        outcome: "rejected",
        statusCode: 429,
      });
      response.status(429).json({
        code: "RATE_LIMITED",
        message: "Too many discovery requests. Wait briefly before trying again.",
        requestId: request.requestId,
      });
      return;
    }

    if (windows.size > 256) {
      for (const [entryKey, entry] of windows) {
        if (currentTime - entry.startedAt >= windowMs) windows.delete(entryKey);
      }
    }
    next();
  };
}

export function securityHeaders(request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com; frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com; worker-src 'self' blob:; frame-ancestors 'none'; form-action 'self'",
    );
    if (request.secure || request.get("x-forwarded-proto") === "https") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  }
  next();
}

export function blockCrossSiteMutations(request, response, next) {
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isMutation && request.get("sec-fetch-site") === "cross-site") {
    recordAuditEvent({
      eventType: "request_rejected",
      requestId: request.requestId,
      outcome: "cross-site",
      statusCode: 403,
    });
    response.status(403).json({
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "Cross-site browser requests are not accepted.",
      requestId: request.requestId,
    });
    return;
  }
  next();
}
