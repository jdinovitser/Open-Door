import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createAccountProgressStore, createAccountSavedDoorStore, createAccountSavedDoorsRouter, normalizeProgressDoorEvents } from "./accountSavedDoors.js";

test("progress events are bounded, validated, and omit client-supplied owner fields", () => {
  const event = { id: "door-a", tier: "Unexpected", category: "Art", userId: "forged-owner" };
  assert.deepEqual(normalizeProgressDoorEvents([event]), [{ id: "door-a", tier: "Unexpected", category: "Art" }]);
  assert.equal(normalizeProgressDoorEvents([event, event]), null);
  assert.equal(normalizeProgressDoorEvents([{ ...event, category: "invalid" }]), null);
  assert.equal(normalizeProgressDoorEvents([{ ...event, tier: "Gold" }]), null);
  assert.equal(normalizeProgressDoorEvents(Array.from({ length: 101 }, (_, i) => ({ ...event, id: String(i) }))), null);
});

test("progress queries are owner-scoped and duplicate door events are idempotent", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT revision")) return { rows: [{ revision: 0, status: "active" }] };
      return { rows: [{ opened_count: 3, brave_count: 1, categories: ["Art", "Music"] }] };
    },
    release() {},
  };
  const store = createAccountProgressStore({ ...client, async connect() { return client; } });
  assert.deepEqual(await store.summary("signed-user"), { doorsOpened: 3, braveDoorsOpened: 1, categories: ["Art", "Music"] });
  await store.addDoors("signed-user", [{ id: "door-a", tier: "Unexpected", category: "Art" }]);
  assert.match(calls[0].sql, /WHERE clerk_user_id = \$1/);
  assert.deepEqual(calls[0].params, ["signed-user"]);
  const insert = calls.find(call => call.sql.includes("INSERT INTO open_door_progress_events"));
  assert.match(insert.sql, /ON CONFLICT \(clerk_user_id, door_id\) DO NOTHING/);
  assert.equal(insert.params[0], "signed-user");
});

test("account-save capacity is enforced inside a serialized transaction and rolls back over-limit writes", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT revision")) return { rows: [{ revision: 0, status: "active" }] };
      return { rows: sql.includes("count(*)") ? [{ total: 101 }] : [] };
    },
    release() { calls.push({ released: true }); },
  };
  const store = createAccountSavedDoorStore({ async connect() { return client; } });
  await assert.rejects(store.applyChanges("signed-user", [{ id: "door-a", title: "A door", tier: "Familiar" }], []), { code: "SAVED_DOOR_LIMIT" });
  assert.ok(calls.some(call => call.sql?.includes("pg_advisory_xact_lock") && call.params[0] === "signed-user"));
  assert.ok(calls.some(call => call.sql === "ROLLBACK"));
  assert.equal(calls.some(call => call.sql === "COMMIT"), false);
  assert.ok(calls.some(call => call.released));
});

test("protected progress routes reject guests and ignore forged owner IDs", async () => {
  const owners = [];
  const app = express();
  app.use(express.json());
  app.use("/api/account", createAccountSavedDoorsRouter({
    pool: {
      async connect() {
        return {
          async query(sql, params) {
            if (sql.includes("INSERT INTO open_door_progress_events")) owners.push(params[0]);
            return { rows: sql.includes("SELECT revision") ? [{ revision: 0, status: "active" }] : [] };
          },
          release() {},
        };
      },
    },
    getUserId: request => request.headers["x-test-session-user"],
  }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${origin}/api/account/progress`)).status, 401);
    assert.equal((await fetch(`${origin}/api/account/progress/doors`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "forged-owner", doors: [{ id: "a", tier: "Familiar", category: "Music" }] }),
    })).status, 401);
    assert.equal(owners.length, 0);
    const response = await fetch(`${origin}/api/account/progress/doors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-session-user": "actual-session-user" },
      body: JSON.stringify({ userId: "forged-owner", revision: 0, doors: [{ id: "a", tier: "Familiar", category: "Music", clerk_user_id: "forged-owner" }] }),
    });
    assert.equal(response.status, 204);
    assert.deepEqual(owners, ["actual-session-user"]);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
