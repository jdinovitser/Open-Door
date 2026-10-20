import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer as createHttpServer } from "node:http";
import express from "express";
import {
  createAccountSavedDoorStore,
  createAccountSavedDoorsRouter,
  normalizeRemovalIds,
  normalizeSavedDoors,
} from "./accountSavedDoors.js";

const validDoor = (id = "door-1") => ({
  id,
  title: "A listening-room ritual",
  tier: "Familiar",
  category: "Music",
  city: "Brooklyn",
  savedAt: "Oct 20",
  anchors: ["live jazz"],
  mode: "live",
  entityId: "qloo-entity-example",
  ignoredCredential: "must never persist",
});

test("saved-door normalization validates required fields, size, count, duplicates, and omits unrelated properties", () => {
  assert.deepEqual(normalizeSavedDoors([validDoor()]), [{
    id: "door-1",
    title: "A listening-room ritual",
    tier: "Familiar",
    category: "Music",
    city: "Brooklyn",
    savedAt: "Oct 20",
    anchors: ["live jazz"],
    mode: "live",
    entityId: "qloo-entity-example",
  }]);
  assert.equal(normalizeSavedDoors([validDoor(), validDoor()]), null);
  assert.equal(normalizeSavedDoors(Array.from({ length: 101 }, (_, i) => validDoor(`door-${i}`))), null);
  assert.equal(normalizeSavedDoors([{ ...validDoor(), title: "" }]), null);
  assert.equal(normalizeSavedDoors([{ ...validDoor(), tier: "guessed" }]), null);
  assert.equal(normalizeSavedDoors([{ ...validDoor(), explainability: "x".repeat(25_000) }]), null);
  assert.deepEqual(normalizeRemovalIds(["door-1", "door-1"]), ["door-1"]);
  assert.equal(normalizeRemovalIds(["x".repeat(257)]), null);
});

test("account storage queries are parameterized and all reads and deletes are owner-scoped", async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params });
      if (sql.includes("SELECT revision")) return { rows: [{ revision: 0, status: "active" }] };
      return { rows: [{ door_data: validDoor() }] };
    },
    release() { calls.push({ released: true }); },
  };
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params });
      return { rows: [{ total: 1 }] };
    },
    async connect() { calls.push({ connected: true }); return client; },
  };
  const store = createAccountSavedDoorStore(pool);
  await store.list("user_a");
  await store.count("user_b");
  await store.applyChanges("user_a", [validDoor()], ["door-2"]);

  const read = calls.find(call => call.sql?.includes("SELECT door_data"));
  assert.deepEqual(read.params, ["user_a"]);
  assert.match(read.sql, /clerk_user_id = \$1/);
  assert.deepEqual(calls.find(call => call.sql?.includes("count"))?.params, ["user_b"]);
  assert.ok(calls.find(call => call.sql?.includes("jsonb_array_elements"))?.sql.includes("$2::jsonb"));
  assert.deepEqual(calls.find(call => call.sql?.includes("jsonb_array_elements"))?.params, ["user_a", JSON.stringify([validDoor()].map(({ ignoredCredential, ...door }) => door))]);
  assert.deepEqual(calls.find(call => call.sql?.includes("ANY(\$2::text\[\])"))?.params, ["user_a", ["door-2"]]);
  assert.ok(calls.some(call => call.sql === "COMMIT"));
  assert.ok(calls.some(call => call.released));
});

test("account routes reject unauthenticated reads before accessing account data", async () => {
  let queries = 0;
  const app = express();
  app.use(express.json());
  app.use("/api/account", createAccountSavedDoorsRouter({
    pool: {
      async connect() {
        return {
          async query(sql) {
            queries++;
            return { rows: sql.includes("SELECT revision") ? [{ revision: 0, status: "active" }] : [] };
          },
          release() {},
        };
      },
    },
    getUserId: request => request.headers["x-test-user"],
  }));
  const server = createHttpServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/account/saved-doors`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(queries, 0);

    const authorized = await fetch(`http://127.0.0.1:${port}/api/account/saved-doors`, {
      headers: { "x-test-user": "user_from_signed_session" },
    });
    assert.equal(authorized.status, 200);
    assert.equal(queries, 6);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
