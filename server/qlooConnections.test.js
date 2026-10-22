import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createQlooConnections } from "./qlooConnections.js";

// All credentials below are invented fixtures; these tests never call Qloo.
async function harness(t, options = {}) {
  const calls = [];
  const connection = createQlooConnections({
    sharedKey: () => "fixture-shared-key",
    clientFactory: ({ apiKey }) => ({
      searchEntities: async (...args) => {
        calls.push({ apiKey, args });
        if (apiKey === "fixture-invalid-key") throw Object.assign(new Error(apiKey), { code: "QLOO_AUTH_ERROR" });
        if (apiKey === "fixture-network-error") throw new Error(apiKey);
        return [];
      },
    }),
    ...options,
  });
  const app = express();
  app.use(express.json());
  app.use("/connection", connection.router);
  app.get("/status", (req, res) => res.json(connection.status(req)));
  app.get("/resolve", (req, res) => {
    const result = connection.resolve(req);
    res.status(result.status || 200).json(result.apiKey
      ? { chosen: result.apiKey === "fixture-shared-key" ? "shared" : "personal" }
      : result);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => {
    connection.close();
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, init) => fetch(`${base}${path}`, init);
  const connect = (apiKey = "fixture-personal-key", headers = {}) => request("/connection", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ apiKey }),
  });
  return { request, connect, calls };
}
const cookieFrom = response => response.headers.get("set-cookie").split(";")[0];
const personalHeaders = cookie => ({ "X-Qloo-Connection": "personal", ...(cookie ? { Cookie: cookie } : {}) });

test("shared and personal connections are explicit; personal never falls back", async t => {
  const { request } = await harness(t);
  assert.equal((await (await request("/status")).json()).connectionSource, "shared");
  const missing = await request("/resolve", { headers: personalHeaders() });
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).message, /will not use the shared/);
  assert.equal((await request("/resolve", { headers: { "X-Qloo-Connection": "unknown" } })).status, 400);
});

test("validates before connecting, keeps keys out of responses and cookies, isolates visitors", async t => {
  const { request, connect, calls } = await harness(t);
  const connected = await connect();
  assert.equal(connected.status, 200);
  assert.deepEqual(calls[0], { apiKey: "fixture-personal-key", args: ["jazz", "artist"] });
  const cookie = cookieFrom(connected);
  assert.match(connected.headers.get("set-cookie"), /HttpOnly/);
  assert.match(connected.headers.get("set-cookie"), /SameSite=Strict/);
  assert.match(connected.headers.get("set-cookie"), /Path=\/api/);
  assert.doesNotMatch(cookie + await connected.text(), /fixture-personal-key/);
  const own = await request("/status", { headers: personalHeaders(cookie) });
  const ownText = await own.text();
  assert.equal(JSON.parse(ownText).personalQlooConnected, true);
  assert.doesNotMatch(ownText, /fixture-/);
  assert.equal((await (await request("/resolve", { headers: personalHeaders(cookie) })).json()).chosen, "personal");
  assert.equal((await (await request("/resolve", { headers: { Cookie: cookie } })).json()).chosen, "shared");
  assert.equal((await request("/resolve", { headers: personalHeaders() })).status, 503);
});

test("disconnect invalidates the cookie and retains shared availability", async t => {
  const { request, connect } = await harness(t);
  const cookie = cookieFrom(await connect());
  const response = await request("/connection", { method: "DELETE", headers: { Cookie: cookie } });
  assert.deepEqual(await response.json(), { connected: false });
  assert.equal((await request("/resolve", { headers: personalHeaders(cookie) })).status, 503);
  assert.equal((await request("/resolve")).status, 200);
});

test("expired sessions fail closed and reconnect rotates tokens", async t => {
  let clock = Date.now();
  const { request, connect } = await harness(t, { now: () => clock, ttlMs: 1000 });
  const first = cookieFrom(await connect());
  const second = cookieFrom(await connect("fixture-personal-key-2", { Cookie: first }));
  assert.notEqual(first, second);
  assert.equal((await request("/resolve", { headers: personalHeaders(first) })).status, 503);
  assert.equal((await request("/resolve", { headers: personalHeaders(second) })).status, 200);
  clock += 1001;
  const status = await (await request("/status", { headers: personalHeaders(second) })).json();
  assert.equal(status.personalQlooConnected, false);
  assert.equal(status.qlooConfigured, false);
  assert.equal((await request("/resolve", { headers: personalHeaders(second) })).status, 503);
});

test("invalid input, rejected keys and upstream errors never establish a session or leak keys", async t => {
  const { connect } = await harness(t);
  for (const [key, expected] of [["bad\nkey", 400], ["fixture-invalid-key", 401], ["fixture-network-error", 502]]) {
    const response = await connect(key);
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.ok(!(await response.text()).includes(key));
  }
});

test("HTTPS cookies, capacity, rate limits and absent shared key", async t => {
  const { connect, request } = await harness(t, { maxSessions: 1, sharedKey: () => undefined });
  assert.equal((await request("/resolve")).status, 503);
  const first = await connect("fixture-personal-key", { "X-Forwarded-Proto": "https" });
  assert.match(first.headers.get("set-cookie"), /Secure/);
  assert.equal((await connect()).status, 503);
  for (let i = 0; i < 8; i++) await connect();
  assert.equal((await connect()).status, 429);
});
