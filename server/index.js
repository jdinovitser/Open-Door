import { createServer as createHttpServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createViteServer } from "vite";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { Pool } from "pg";
import { getAgentError, runDiscovery, validateDiscoveryRequest } from "./agent.js";
import { createQlooClient } from "./qloo.js";
import { createAccountSavedDoorsRouter } from "./accountSavedDoors.js";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware.js";
import { APP_POLICY, publicPolicy } from "./policy.js";
import {
  attachRequestId,
  blockCrossSiteMutations,
  createRateLimiter,
  getRecentAuditEvents,
  recordAuditEvent,
  securityHeaders,
} from "./security.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5000);
const app = express();
const httpServer = createHttpServer(app);
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 })
  : null;

app.disable("x-powered-by");
app.use(attachRequestId);
app.use(securityHeaders);
app.use(blockCrossSiteMutations);
if (production) app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api/account", express.json({ limit: "512kb" }));
app.use(express.json({ limit: APP_POLICY.maxRequestBytes }));
app.use(clerkMiddleware(request => ({
  publishableKey: publishableKeyFromHost(
    getClerkProxyHost(request) ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  ),
})));
app.use("/api/account", createAccountSavedDoorsRouter({
  pool,
  getUserId: request => getAuth(request)?.userId || null,
}));

app.get("/api/status", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({
    qlooConfigured: Boolean(process.env.QLOO_API_KEY),
    agent: "Open Door structured tool orchestration",
    demoAvailable: true,
    authenticationConfigured: Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
    policy: publicPolicy(),
  });
});

app.get("/api/health", async (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  let database = "not-configured";
  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "operational";
    } catch {
      database = "unavailable";
    }
  }
  response.json({
    status: "operational",
    checkedAt: new Date().toISOString(),
    components: {
      api: "operational",
      agent: "available",
      qloo: process.env.QLOO_API_KEY ? "configured-not-probed" : "not-configured",
      database,
      authentication: process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY ? "configured" : "not-configured",
      analytics: "not-used",
      audit: "process-memory-only",
    },
    policy: publicPolicy(),
  });
});

if (!production) {
  app.get("/api/dev/audit", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({
      available: true,
      persistence: "process-memory-only",
      tamperResistant: false,
      events: getRecentAuditEvents(),
    });
  });
}

app.post(
  "/api/agent/discover",
  createRateLimiter(),
  async (request, response) => {
  const requestId = request.requestId;
  let validatedRequest;
  try {
    validatedRequest = validateDiscoveryRequest(request.body);
  } catch (error) {
    const safeError = getAgentError(error);
    recordAuditEvent({
      eventType: "request_rejected",
      requestId,
      outcome: safeError.code,
      statusCode: safeError.status,
    });
    response.status(safeError.status).json({
      code: safeError.code,
      message: safeError.message,
      details: safeError.details,
      requestId,
    });
    return;
  }

  if (!process.env.QLOO_API_KEY) {
    recordAuditEvent({
      eventType: "request_rejected",
      requestId,
      outcome: "qloo-not-configured",
      statusCode: 503,
    });
    response.status(503).json({
      code: "QLOO_NOT_CONFIGURED",
      message: "Live Qloo is not configured. Use Demo Mode or add the QLOO_API_KEY secret after receiving a hackathon API key.",
      requestId,
    });
    return;
  }

  const startedAt = Date.now();
  recordAuditEvent({ eventType: "discovery_requested", requestId, outcome: "started" });
  response.status(200);
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  const abortController = new AbortController();
  response.on("close", () => {
    if (!response.writableEnded) {
      abortController.abort();
      recordAuditEvent({
        eventType: "client_disconnect",
        requestId,
        outcome: "aborted",
        durationMs: Date.now() - startedAt,
      });
    }
  });
  const emit = event => {
    if (!response.destroyed && !response.writableEnded) {
      response.write(`${JSON.stringify({ ...event, requestId })}\n`);
    }
  };

  try {
    const qloo = createQlooClient({ apiKey: process.env.QLOO_API_KEY });
    const journey = await runDiscovery(validatedRequest, {
      qloo,
      emit,
      signal: abortController.signal,
      onToolEvent: event => recordAuditEvent({
        eventType: "tool_call",
        requestId,
        toolName: event.toolName,
        outcome: event.outcome === "success" ? "success" : event.outcome === "started" ? "started" : "failed",
        durationMs: event.durationMs,
      }),
    });
    journey.methodology.requestId = requestId;
    recordAuditEvent({
      eventType: "discovery_completed",
      requestId,
      outcome: "success",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      count: journey.doors.length,
    });
    emit({ type: "complete", journey });
  } catch (error) {
    const safeError = getAgentError(error);
    recordAuditEvent({
      eventType: "request_failed",
      requestId,
      outcome: safeError.code,
      statusCode: safeError.status,
      durationMs: Date.now() - startedAt,
    });
    emit({
      type: "error",
      code: safeError.code,
      message: safeError.message,
      details: safeError.details,
    });
  } finally {
    if (!response.writableEnded) response.end();
  }
  },
);

app.use("/api", (_request, response) => {
  response.status(404).json({ code: "API_ROUTE_NOT_FOUND", message: "This Open Door API route does not exist." });
});

if (production) {
  const distDirectory = resolve(projectRoot, "dist");
  app.use(express.static(distDirectory, { index: false }));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api/")) {
      response.sendFile(resolve(distDirectory, "index.html"));
      return;
    }
    next();
  });
} else {
  const vite = await createViteServer({
    configFile: resolve(projectRoot, "vite.config.ts"),
    appType: "spa",
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: { server: httpServer },
    },
  });
  app.use(vite.middlewares);
}

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  const status = error?.type === "entity.too.large"
    ? 413
    : error?.type === "entity.parse.failed"
      ? 400
      : Number(error?.status) || 500;
  const code = status === 413 ? "REQUEST_TOO_LARGE" : status === 400 ? "INVALID_JSON" : "SERVER_ERROR";
  response.status(status).json({
    code,
    message: status === 413
      ? "The request is larger than Open Door accepts."
      : status < 500
        ? "The request could not be processed."
        : "Open Door encountered a server error.",
    requestId: response.getHeader("X-Request-ID"),
  });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Open Door server listening on port ${port}`);
});
