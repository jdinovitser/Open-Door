import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const bundled = buildSync({
  stdin: { contents: 'export * from "./src/company/commercialRouting"; export * from "./src/authReturn";', resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { legacyCompanyDestination, safeAppReturnTo } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

test("legacy company home leads to the renamed business page", () => {
  assert.equal(legacyCompanyDestination(""), "/partners");
});
test("old inquiry links preserve intent and company type on the dedicated contact page", () => {
  assert.equal(legacyCompanyDestination("?type=celebrations&inquiry=partnership", "#inquiry"), "/contact?type=celebrations&inquiry=partnership#inquiry");
  assert.equal(legacyCompanyDestination("?type=other&inquiry=investment"), "/contact?type=other&inquiry=investment#inquiry");
  assert.equal(legacyCompanyDestination("", "#inquiry"), "/contact#inquiry");
});
test("organizer links now open real discovery tools without passing private or unknown data", () => {
  const value = legacyCompanyDestination("?type=real-estate&place=Brooklyn&occasion=An+afternoon&scenario=private&apiKey=not-a-key", "#company-type");
  const url = new URL(value, "https://example.test");
  assert.equal(url.pathname, "/companies/discover");
  assert.equal(url.hash, "#company-tools");
  assert.equal(url.searchParams.get("type"), "real-estate");
  assert.equal(url.searchParams.get("place"), "Brooklyn");
  assert.equal(url.searchParams.get("occasion"), "An afternoon");
  assert.equal(url.searchParams.has("scenario"), false);
  assert.equal(url.searchParams.has("apiKey"), false);
});
test("old walkthrough and use-case bookmarks point into regular discovery", () => {
  for (const hash of ["#company-walkthrough", "#use-cases"]) {
    assert.equal(legacyCompanyDestination("", hash), "/?explore=1&audience=company#company-tools");
  }
});
test("commercial pages and discovery audience survive a safe sign-in return", () => {
  for (const path of ["/partners", "/mockups", "/contact?inquiry=partnership"]) assert.equal(safeAppReturnTo(path), path);
  assert.equal(safeAppReturnTo("/lab?audience=company"), "/lab?audience=company");
  assert.equal(safeAppReturnTo("/?explore=1&audience=company"), "/?explore=1&audience=company");
  assert.equal(safeAppReturnTo("https://external.test/contact"), "/");
});
