import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { Pool } from "pg";
import { createCompanyInquiriesRouter, validateCompanyInquiry } from "./companyInquiries.js";
import { blockCrossSiteMutations } from "./security.js";

const inquiry = () => ({
  requestId: randomUUID(), companyType: "hospitality", company: "Example Hotel",
  name: "Test Contact", email: "contact@example.test", website: "https://example.test",
  typeDescription: "", details: "Help our guests explore cultural interests before an evening show.", consent: true,
});
test("company inquiries validate bounded fields, explicit consent and safe website URLs", () => {
  assert.equal(validateCompanyInquiry(inquiry()).companyType, "hospitality");
  for (const patch of [
    { consent: false }, { companyType: "invalid" }, { company: "" }, { name: "" },
    { email: "not-an-email" }, { website: "javascript:alert(1)" }, { website: "https://user:pass@example.test" },
    { details: "short" }, { details: "x".repeat(4001) }, { requestId: "invalid" },
    { companyType: "other", typeDescription: "" }, { websiteTrap: "spam" },
  ]) assert.throws(() => validateCompanyInquiry({ ...inquiry(), ...patch }));
  assert.equal(validateCompanyInquiry({ ...inquiry(), companyType: "other", typeDescription: "Tour operator" }).typeDescription, "Tour operator");
});

async function harness(t, pool, options = {}) {
  const app = express();
  app.use(blockCrossSiteMutations);
  app.use(express.json({ limit: "24kb" }));
  app.use("/api/company", createCompanyInquiriesRouter({
    pool,
    getUserId: request => request.get("x-fixture-user") || null,
    users: { getUser: async id => {
      if (id === "unavailable") throw new Error("Private upstream failure");
      return { publicMetadata: { role: id === "admin" ? "admin" : "member" } };
    } },
    limiter: (_request, _response, next) => next(),
    ...options,
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  return (path, { body, user, ...init } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/company${path}`, {
    ...init, headers: { "Content-Type": "application/json", ...(user ? { "x-fixture-user": user } : {}), ...init.headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("all inquiry reads and mutations require server-side admin role, never a client role", async t => {
  let dbCalls = 0;
  const request = await harness(t, { query: async () => { dbCalls++; throw new Error("Must not query private data"); } });
  for (const [path, method, body] of [
    ["/admin/access", "GET"], ["/admin/inquiries", "GET"],
    [`/admin/inquiries/${randomUUID()}`, "PATCH", { status: "contacted", role: "admin" }],
    [`/admin/inquiries/${randomUUID()}`, "DELETE"],
  ]) {
    assert.equal((await request(path, { method, body })).status, 401);
    assert.equal((await request(path, { method, body, user: "member", headers: { "x-role": "admin" } })).status, 403);
  }
  assert.equal((await request("/admin/access", { user: "unavailable" })).status, 503);
  assert.equal(dbCalls, 0);
  const response = await request("/admin/access", { user: "admin" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { admin: true });
});

test("inquiry errors fail explicitly, never claim saved, and cross-site submissions are blocked", async t => {
  const request = await harness(t, { query: async () => { throw new Error("Secret database details"); } });
  const response = await request("/inquiries", { method: "POST", body: inquiry() });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /Secret database/);
  assert.equal((await request("/inquiries", { method: "POST", body: inquiry(), headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await request("/inquiries", { method: "POST", body: { ...inquiry(), consent: false } })).status, 400);
});

test("company inquiry persistence, retry deduplication, filtering, pagination, status and deletion", { skip: !process.env.DATABASE_URL }, async t => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const schema = `inquiry_test_${randomUUID().replaceAll("-", "")}`;
  // Identifiers are generated here, never from user input. Isolated development test data.
  await pool.query(`CREATE SCHEMA ${schema}`);
  const schemaSQL = await readFile(new URL("./migrations/20261022-company-inquiries.sql", import.meta.url), "utf8");
  await pool.query(schemaSQL.replaceAll("open_door_company_inquiries", `${schema}.open_door_company_inquiries`)
    .replace(`CREATE INDEX IF NOT EXISTS ${schema}.open_door_company_inquiries_status_created`, "CREATE INDEX IF NOT EXISTS open_door_company_inquiries_status_created"));
  t.after(async () => { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });
  const scoped = { query: (sql, params) => pool.query(sql.replaceAll("open_door_company_inquiries", `${schema}.open_door_company_inquiries`), params) };
  const request = await harness(t, scoped);
  const data = inquiry();
  const first = await request("/inquiries", { method: "POST", body: data });
  assert.equal(first.status, 201);
  const receipt = await first.json();
  assert.deepEqual(Object.keys(receipt).sort(), ["id", "submittedAt"]);
  const retry = await request("/inquiries", { method: "POST", body: { ...data, company: "Ignored retry changes" } });
  assert.deepEqual(await retry.json(), receipt);
  let response = await request("/admin/inquiries?status=new&page=1", { user: "admin" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  let results = await response.json();
  assert.equal(results.total, 1);
  assert.equal(results.inquiries[0].company, "Example Hotel");
  assert.equal(results.inquiries[0].email, data.email);
  const update = await request(`/admin/inquiries/${data.requestId}`, { method: "PATCH", user: "admin", body: { status: "reviewing" } });
  assert.equal((await update.json()).inquiry.status, "reviewing");
  results = await (await request("/admin/inquiries?status=new", { user: "admin" })).json();
  assert.equal(results.total, 0);
  assert.equal((await request("/admin/inquiries?status=bad", { user: "admin" })).status, 400);
  assert.equal((await request("/admin/inquiries?page=-1", { user: "admin" })).status, 400);
  assert.equal((await request("/admin/inquiries?page=2", { user: "admin" }).then(r => r.json())).inquiries.length, 0);
  assert.equal((await request(`/admin/inquiries/${data.requestId}`, { method: "PATCH", user: "admin", body: { status: "bogus" } })).status, 400);
  assert.equal((await request(`/admin/inquiries/${data.requestId}`, { method: "DELETE", user: "admin" })).status, 200);
  assert.equal((await request(`/admin/inquiries/${data.requestId}`, { method: "DELETE", user: "admin" })).status, 404);
  assert.equal((await request("/admin/inquiries", { user: "admin" }).then(r => r.json())).total, 0);
});
