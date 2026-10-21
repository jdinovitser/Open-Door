import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import { Pool } from "pg";
import { createAccountProgressStore, createAccountSavedDoorStore, createAccountSavedDoorsRouter } from "./accountSavedDoors.js";
import { eraseAccountData, finishAccountClosure, reconcileAccountClosures } from "./accountLifecycle.js";
import { blockCrossSiteMutations } from "./security.js";

test("account deletion and lifecycle integration with isolated PostgreSQL tables", { skip: !process.env.DATABASE_URL }, async t => {
  const schema = `deletion_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 5 });
  let server;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
    const doors = createAccountSavedDoorStore(pool);
    const progress = createAccountProgressStore(pool);
    const door = { id: "same-door", title: "A door", tier: "Unexpected", category: "Art" };
    const seed = async owner => {
      await doors.applyChanges(owner, [door], [], 0);
      await progress.addDoors(owner, [door], 0);
    };
    const counts = async owner => {
      const saved = await doors.count(owner);
      const summary = await progress.summary(owner);
      return [saved, summary.doorsOpened];
    };
    let clerkFailure = false;
    const deletedUsers = [];
    const users = {
      async deleteUser(owner) {
        deletedUsers.push(owner);
        if (clerkFailure) throw Object.assign(new Error("Unavailable"), { status: 503 });
      },
    };
    const app = express();
    app.use(blockCrossSiteMutations);
    app.use(express.json());
    // Test harness only: production derives ownership from verified Clerk sessions.
    app.use("/api/account", createAccountSavedDoorsRouter({ pool, users, getUserId: req => req.headers["x-test-user"] }));
    server = createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/account`;
    const remove = (owner, scope, extra = {}, headers = {}) => fetch(`${base}${scope === "close" ? "" : "/data"}?userId=victim`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(owner ? { "x-test-user": owner } : {}), ...headers },
      body: JSON.stringify({ scope, confirmation: scope === "close" ? "CLOSE" : "ERASE", ...extra }),
    });

    await t.test("preferences require sign-in, consented fields and revision; isolate owners and forget safely", async () => {
      const preference = { intent: "Go deeper", depth: "A little further", budget: "Moderate", movement: "Mostly seated" };
      const memory = (owner, method = "GET", body, extraHeaders = {}) => fetch(`${base}/preferences?userId=victim`, {
        method,
        headers: { "Content-Type": "application/json", ...(owner ? { "x-test-user": owner } : {}), ...extraHeaders },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal((await memory(null)).status, 401);
      assert.equal((await memory(null, "PUT", { preferences: preference, revision: 0 })).status, 401);
      assert.deepEqual(await (await memory("memory-owner")).json(), { preferences: null, revision: 0 });
      assert.equal((await memory("memory-owner", "PUT", { preferences: preference })).status, 409);
      assert.equal((await memory("memory-owner", "PUT", { preferences: { ...preference, scenario: "private" }, revision: 0 })).status, 400);
      assert.equal((await memory("memory-owner", "PUT", { preferences: preference, revision: 0 }, { "sec-fetch-site": "cross-site" })).status, 403);
      const saved = await memory("memory-owner", "PUT", { preferences: preference, revision: 0, userId: "victim" });
      assert.equal(saved.status, 200);
      assert.deepEqual(await saved.json(), { preferences: preference, revision: 0 });
      assert.deepEqual(await (await memory("victim")).json(), { preferences: null, revision: 0 });
      assert.deepEqual(await (await memory("memory-owner")).json(), { preferences: preference, revision: 0 });
      assert.deepEqual(await (await memory("memory-owner", "DELETE", { revision: 0 })).json(), { preferences: null, revision: 1 });
      assert.equal((await memory("memory-owner", "PUT", { preferences: preference, revision: 0 })).status, 409);
      assert.equal((await memory("memory-owner", "PUT", { preferences: preference, revision: 1 })).status, 200);
      await remove("memory-owner", "all");
      assert.deepEqual(await (await memory("memory-owner")).json(), { preferences: null, revision: 2 });
      await memory("memory-owner", "PUT", { preferences: preference, revision: 2 });
      await remove("memory-owner", "close");
      assert.equal((await memory("memory-owner")).status, 409);
      const erased = await pool.query("SELECT preferences FROM open_door_account_state WHERE clerk_user_id = $1", ["memory-owner"]);
      assert.equal(erased.rows[0].preferences, null);
      // The other lifecycle subtests assert that only their own close called Clerk.
      deletedUsers.length = 0;
    });

    await t.test("guests, missing confirmation, and cross-site requests cannot erase anything", async () => {
      await seed("victim");
      assert.equal((await remove(null, "all")).status, 401);
      assert.equal((await remove(null, "close")).status, 401);
      assert.equal((await remove("victim", "all", { confirmation: "" })).status, 400);
      assert.equal((await remove("victim", "close", { confirmation: "" })).status, 400);
      assert.equal((await remove("victim", "all", {}, { "sec-fetch-site": "cross-site" })).status, 403);
      assert.equal((await remove("victim", "close", {}, { "sec-fetch-site": "cross-site" })).status, 403);
      assert.deepEqual(await counts("victim"), [1, 1]);
      assert.deepEqual(deletedUsers, []);
    });

    await t.test("each erasure scope is owner-isolated even with forged body/query IDs", async () => {
      for (const [scope, expected] of [["progress", [1, 0]], ["saved-doors", [0, 1]], ["all", [0, 0]]]) {
        const owner = `owner-${scope}`;
        await seed(owner);
        const response = await remove(owner, scope, { userId: "victim", clerk_user_id: "victim" });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { erased: scope, revision: 1 });
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(await counts(owner), expected);
        assert.deepEqual(await counts("victim"), [1, 1]);
        await assert.rejects(doors.applyChanges(owner, [door], [], 0), { code: "ACCOUNT_STATE_CHANGED" });
        await assert.rejects(progress.addDoors(owner, [door], 0), { code: "ACCOUNT_STATE_CHANGED" });
        // New, explicit activity after reloading is permitted for an open account.
        await progress.addDoors(owner, [door], 1);
      }
    });

    await t.test("partial database failure rolls back both data sets and the version", async () => {
      await seed("rollback");
      await pool.query(`CREATE FUNCTION reject_test_delete() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF OLD.clerk_user_id = 'rollback' THEN RAISE EXCEPTION 'simulated failure'; END IF; RETURN OLD; END $$;
        CREATE TRIGGER reject_test_delete BEFORE DELETE ON open_door_progress_events
        FOR EACH ROW EXECUTE FUNCTION reject_test_delete();`);
      const response = await remove("rollback", "all");
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "ERASURE_UNCONFIRMED");
      assert.deepEqual(await counts("rollback"), [1, 1]);
      const state = await pool.query("SELECT revision FROM open_door_account_state WHERE clerk_user_id = $1", ["rollback"]);
      assert.equal(state.rows[0].revision, 0);
      await pool.query("DROP TRIGGER reject_test_delete ON open_door_progress_events; DROP FUNCTION reject_test_delete()");
    });

    await t.test("closure failure leaves a durable retry marker and blocks stale writes", async () => {
      await seed("retry-close");
      clerkFailure = true;
      const response = await remove("retry-close", "close", { userId: "victim" });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "CLOSURE_PENDING");
      assert.deepEqual(await counts("retry-close"), [0, 0]);
      assert.equal(deletedUsers.at(-1), "retry-close");
      assert.deepEqual(await counts("victim"), [1, 1]);
      await assert.rejects(progress.addDoors("retry-close", [door], 1), { code: "ACCOUNT_STATE_CHANGED" });
      await assert.rejects(doors.applyChanges("retry-close", [door], [], 1), { code: "ACCOUNT_STATE_CHANGED" });
      clerkFailure = false;
      await finishAccountClosure(pool, "retry-close", users);
      const result = await pool.query("SELECT status FROM open_door_account_state WHERE clerk_user_id = $1", ["retry-close"]);
      assert.equal(result.rows[0].status, "closed");
      assert.equal((await remove("retry-close", "close")).status, 200); // idempotent retry
    });

    await t.test("worker cleans external deletions only on confirmed Clerk 404 and retries closures", async () => {
      await seed("external-delete");
      await seed("clerk-timeout");
      await seed("worker-close");
      await eraseAccountData(pool, "worker-close", "close");
      const workerDeletes = [];
      const result = await reconcileAccountClosures(pool, {
        async getUser(owner) {
          if (owner === "external-delete") throw Object.assign(new Error("Not found"), { status: 404 });
          if (owner === "clerk-timeout") throw Object.assign(new Error("Network failure"), { status: 503 });
        },
        async deleteUser(owner) {
          workerDeletes.push(owner);
          throw Object.assign(new Error("Already gone"), { status: 404 });
        },
      });
      assert.equal(result.failures, 1);
      assert.deepEqual(await counts("external-delete"), [0, 0]);
      assert.deepEqual(await counts("clerk-timeout"), [1, 1]);
      assert.deepEqual(workerDeletes, ["worker-close"]);
      assert.deepEqual(await counts("victim"), [1, 1]);
      await assert.rejects(progress.addDoors("external-delete", [door], 1), { code: "ACCOUNT_STATE_CHANGED" });
    });

    await t.test("erasure and concurrent stale writes serialize without restoring erased data", async () => {
      await seed("race");
      // Hold the same owner lock while both operations queue behind it.
      const lock = await pool.connect();
      await lock.query("BEGIN");
      await lock.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", ["race"]);
      const erased = eraseAccountData(pool, "race", "all");
      // Both possible lock orders are safe: old write before erasure is removed,
      // old write after erasure is rejected.
      const write = progress.addDoors("race", [{ ...door, id: "stale-door" }], 0).catch(error => {
        assert.equal(error.code, "ACCOUNT_STATE_CHANGED");
      });
      await lock.query("COMMIT");
      lock.release();
      await Promise.all([erased, write]);
      assert.deepEqual(await counts("race"), [0, 0]);
    });

    await t.test("missing revision cannot silently restore data through HTTP writes", async () => {
      for (const [path, body] of [
        ["/saved-doors", { upserts: [door], removals: [] }],
        ["/progress/doors", { doors: [door] }],
      ]) {
        const response = await fetch(`${base}${path}`, {
          method: path === "/saved-doors" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", "x-test-user": "victim" },
          body: JSON.stringify(body),
        });
        assert.equal(response.status, 409);
      }
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
