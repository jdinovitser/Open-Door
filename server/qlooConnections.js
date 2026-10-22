import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { createQlooClient } from "./qloo.js";
import { createRateLimiter } from "./security.js";

const COOKIE = "opendoor_qloo_session";
const digest = token => createHash("sha256").update(token).digest("hex");

// Keys never leave this process, enter the database, or appear in the cookie.
export function createQlooConnections({
  sharedKey = () => process.env.QLOO_API_KEY,
  clientFactory = createQlooClient,
  now = Date.now,
  ttlMs = 60 * 60 * 1000,
  maxSessions = 500,
} = {}) {
  const sessions = new Map();
  const router = Router();
  const cookieOptions = request => ({
    httpOnly: true, sameSite: "strict", path: "/api",
    secure: request.secure || request.get("x-forwarded-proto") === "https",
  });
  function prune() {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
  }
  const cleanup = setInterval(prune, 60_000);
  cleanup.unref();
  function sessionId(request) {
    const token = (request.get("cookie") || "").split(";")
      .map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
  }
  function personalSession(request) {
    const id = sessionId(request);
    const session = id && sessions.get(id);
    if (session && session.expiresAt <= now()) { sessions.delete(id); return null; }
    return session || null;
  }
  function source(request) {
    return request.get("x-qloo-connection") || "shared";
  }
  function status(request) {
    const personal = personalSession(request);
    const shared = Boolean(sharedKey());
    const own = source(request) === "personal";
    return {
      qlooConfigured: own ? Boolean(personal) : shared,
      sharedQlooConfigured: shared,
      personalQlooConnected: Boolean(personal),
      connectionSource: own ? (personal ? "personal" : "none") : (shared ? "shared" : "none"),
      connectionExpiresAt: personal ? new Date(personal.expiresAt).toISOString() : null,
    };
  }
  function resolve(request) {
    const selection = source(request);
    if (!["shared", "personal"].includes(selection)) return { code: "INVALID_QLOO_CONNECTION", status: 400, message: "Choose Demo or Connect your own." };
    const apiKey = selection === "personal" ? personalSession(request)?.apiKey : sharedKey();
    if (!apiKey) return {
      code: "QLOO_NOT_CONFIGURED", status: 503,
      message: selection === "personal"
        ? "Your Qloo connection is missing or expired. Reconnect your key; we will not use the shared connection instead."
        : "The shared Qloo connection is unavailable. Connect your own key or try the clearly labeled prepared examples.",
    };
    return { apiKey };
  }
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/", createRateLimiter({ maxRequests: 10, windowMs: 60_000 }), async (request, response) => {
    const apiKey = request.body?.apiKey;
    if (typeof apiKey !== "string" || !/^[\x21-\x7e]{8,512}$/.test(apiKey)) {
      response.status(400).json({ message: "Enter a valid Qloo API key without spaces." });
      return;
    }
    prune();
    if (sessions.size >= maxSessions && !personalSession(request)) {
      response.status(503).json({ message: "Connections are temporarily full. Please try again later." });
      return;
    }
    try {
      // Fixed Qloo host; a successful request verifies the key before saving it.
      await clientFactory({ apiKey }).searchEntities("jazz", "artist");
      prune();
      if (sessions.size >= maxSessions && !personalSession(request)) {
        response.status(503).json({ message: "Connections are temporarily full. Please try again later." });
        return;
      }
      const token = randomBytes(32).toString("hex");
      const expiresAt = now() + ttlMs;
      const oldId = sessionId(request);
      if (oldId) sessions.delete(oldId);
      sessions.set(digest(token), { apiKey, expiresAt });
      response.cookie(COOKIE, token, { ...cookieOptions(request), maxAge: ttlMs });
      response.json({ connected: true, expiresAt: new Date(expiresAt).toISOString() });
    } catch (error) {
      const authError = error?.code === "QLOO_AUTH_ERROR";
      response.status(authError ? 401 : 502).json({
        message: authError
          ? "Qloo did not accept this key. Check that it works with the hackathon API."
          : "Qloo could not verify the connection. Please try again shortly.",
      });
    }
  });
  router.delete("/", (request, response) => {
    const id = sessionId(request);
    if (id) sessions.delete(id);
    response.clearCookie(COOKIE, cookieOptions(request));
    response.json({ connected: false });
  });
  return { router, status, resolve, close: () => { clearInterval(cleanup); sessions.clear(); } };
}
