import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const bundled = buildSync({
  stdin: { contents: 'export * from "./src/company/inquiryIntent"; export * from "./src/authReturn";', resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { inquiryIntentFromSearch, safeAppReturnTo } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("partnership and investment links initialize distinct, editable inquiry templates", () => {
  const partnership = inquiryIntentFromSearch("?inquiry=partnership");
  assert.equal(partnership.id, "partnership");
  assert.match(partnership.details, /^Partnership inquiry:/);
  assert.equal(partnership.typeDescription, "");
  const investment = inquiryIntentFromSearch("?inquiry=investment");
  assert.equal(investment.id, "investment");
  assert.match(investment.details, /^Investment conversation:/);
  assert.match(investment.typeDescription, /Investment/);
});

test("unknown inquiry topics cannot introduce arbitrary copied text", () => {
  for (const value of ["", "?inquiry=other", "?inquiry=%3Cscript%3E", "?inquiry=https://example.test"]) {
    assert.equal(inquiryIntentFromSearch(value), null);
  }
});

test("sign-in returns to partnerships and preserves only allowlisted inquiry intentions", () => {
  assert.equal(safeAppReturnTo("/partners"), "/partners");
  assert.equal(safeAppReturnTo("/companies?type=other&inquiry=investment&email=private"), "/companies?type=other&inquiry=investment");
  assert.equal(safeAppReturnTo("/companies?inquiry=partnership"), "/companies?inquiry=partnership");
  assert.equal(safeAppReturnTo("/companies?inquiry=unknown"), "/companies");
  assert.equal(safeAppReturnTo("//external.test/partners"), "/");
});
