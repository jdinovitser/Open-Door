import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { APP_POLICY } from "./policy.js";
import {
  attachRequestId,
  blockCrossSiteMutations,
  createRateLimiter,
  getRecentAuditEvents,
  recordAuditEvent,
  securityHeaders,
} from "./security.js";

function responseStub() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("request IDs are attached to the request and response", () => {
  const request = {};
  const response = responseStub();
  let advanced = false;
  attachRequestId(request, response, () => { advanced = true; });

  assert.match(request.requestId, /^od-\d{4}-\d{2}-\d{2}-[0-9a-f-]{8}$/);
  assert.equal(response.getHeader("X-Request-ID"), request.requestId);
  assert.equal(advanced, true);
});

test("production security headers include CSP, no-referrer, and frame protections", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const response = responseStub();
    securityHeaders({ secure: true, get: () => undefined }, response, () => {});
    assert.equal(response.getHeader("X-Content-Type-Options"), "nosniff");
    assert.equal(response.getHeader("Referrer-Policy"), "no-referrer");
    assert.match(response.getHeader("Content-Security-Policy"), /frame-ancestors 'none'/);
    assert.equal(response.getHeader("X-Frame-Options"), "DENY");
    assert.match(response.getHeader("Strict-Transport-Security"), /max-age=/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("cross-site browser mutations are rejected without treating the guard as authentication", () => {
  const response = responseStub();
  let advanced = false;
  blockCrossSiteMutations({
    method: "POST",
    requestId: "test-request",
    get: name => name === "sec-fetch-site" ? "cross-site" : undefined,
  }, response, () => { advanced = true; });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "CROSS_SITE_REQUEST_BLOCKED");
  assert.equal(advanced, false);
});

test("same-origin mutations continue to the route", () => {
  let advanced = false;
  blockCrossSiteMutations({
    method: "POST",
    get: name => name === "sec-fetch-site" ? "same-origin" : undefined,
  }, responseStub(), () => { advanced = true; });
  assert.equal(advanced, true);
});

test("rate limiter rejects over-limit requests and resets after the window", () => {
  let time = 10_000;
  const limit = createRateLimiter({
    windowMs: 1_000,
    maxRequests: 2,
    keyForRequest: () => "test-client",
    now: () => time,
  });
  const pass = () => {
    let advanced = false;
    limit({ requestId: "rate-test", socket: {} }, responseStub(), () => { advanced = true; });
    return advanced;
  };
  assert.equal(pass(), true);
  assert.equal(pass(), true);

  const deniedResponse = responseStub();
  limit({ requestId: "rate-test", socket: {} }, deniedResponse, () => {});
  assert.equal(deniedResponse.statusCode, 429);
  assert.equal(deniedResponse.body.code, "RATE_LIMITED");
  assert.ok(Number(deniedResponse.getHeader("Retry-After")) > 0);

  time += 1_001;
  assert.equal(pass(), true);
});

test("audit records use the fixed metadata schema and exclude unrecognized input fields", () => {
  const requestId = `audit-test-${Date.now()}`;
  const record = recordAuditEvent({
    eventType: "tool_call",
    requestId,
    toolName: "qlooSearch",
    outcome: "success",
    durationMs: 21,
    userInput: "private interest",
    location: "private place",
    apiKey: "never-log-this",
  });
  const returned = getRecentAuditEvents().find(event => event.requestId === requestId);
  assert.equal(record, returned);
  assert.equal(returned.toolName, "qlooSearch");
  assert.equal(returned.durationMs, 21);
  assert.equal("userInput" in returned, false);
  assert.equal("location" in returned, false);
  assert.equal("apiKey" in returned, false);
  assert.equal(JSON.stringify(returned).includes("never-log-this"), false);
});

test("JSON parsing rejects oversized and malformed bodies with request IDs and no CORS grant", async t => {
  const app = express();
  app.use(attachRequestId);
  app.use(securityHeaders);
  app.use(blockCrossSiteMutations);
  app.use(express.json({ limit: APP_POLICY.maxRequestBytes }));
  app.post("/test", (_request, response) => response.json({ accepted: true }));
  app.use((error, _request, response, _next) => {
    const status = error?.type === "entity.too.large" ? 413 : error?.type === "entity.parse.failed" ? 400 : 500;
    response.status(status).json({ code: status === 413 ? "REQUEST_TOO_LARGE" : "INVALID_JSON" });
  });

  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/test`;

  const oversizedResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", Origin: "https://untrusted.example" },
    body: JSON.stringify({ data: "x".repeat(APP_POLICY.maxRequestBytes + 100) }),
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).code, "REQUEST_TOO_LARGE");
  assert.ok(oversizedResponse.headers.get("x-request-id"));
  assert.equal(oversizedResponse.headers.get("access-control-allow-origin"), null);

  const malformedResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
    body: "{",
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).code, "INVALID_JSON");
});
