import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const bundled = buildSync({
  stdin: { contents: 'export * from "./src/company/experienceContext"; export * from "./src/authReturn";', resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "esm", write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const values = new Map();
globalThis.sessionStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const draft = () => ({
  location: "Visitor's edited place", occasion: "Visitor's edited afternoon",
  anchors: ["Nina Simone"], categories: { "Nina Simone": "Music" },
  context: { time: "Visitor's edited afternoon", budget: "Under $30", movement: "Easy pace", conditions: "Return by 5",
    scenario: "I want seated breaks and quiet options.", scenarioCategory: "wellbeing" },
});

test("guest links contain only public organizer context, never private preferences", () => {
  const url = api.companyExperienceUrl("discover", "hospitality", {
    location: "Montréal & Québec", occasion: "Before the evening show",
    scenario: "Private visitor needs", apiKey: "invented-not-a-key",
  });
  const params = new URL(url, "https://example.test").searchParams;
  assert.deepEqual([...params.keys()], ["type", "place", "occasion"]);
  assert.equal(params.get("place"), "Montréal & Québec");
  assert.doesNotMatch(url, /Private|invented|scenario|apiKey/);
  assert.deepEqual(api.readPublicOccasion("?place=Paris&occasion=Afternoon&scenario=private"), { location: "Paris", occasion: "Afternoon" });
});

test("public invitations isolate visitor drafts and Lab history scope without splitting personal accounts", () => {
  values.clear();
  const a = { location: "Boston", occasion: "Before the show" };
  const b = { location: "Boston", occasion: "After the conference" };
  api.writeCompanyDraft("hospitality", draft(), a);
  assert.equal(api.readCompanyDraft("hospitality", a).context.scenarioCategory, "wellbeing");
  assert.equal(api.readCompanyDraft("hospitality", b), null);
  assert.notEqual(api.companyContextScope("hospitality", a), api.companyContextScope("hospitality", b));
  assert.equal(api.companyContextScope("hospitality", { location: "New Orleans, Louisiana", occasion: "A free afternoon before an evening show" }), api.companyContextScope("hospitality"));
  api.clearCompanyDraft("hospitality", a);
  assert.equal(api.readCompanyDraft("hospitality", a), null);
});

test("visitor edits survive reload rather than being replaced by invitation defaults", () => {
  values.clear();
  const publicOccasion = { location: "Boston", occasion: "Before the show" };
  api.writeCompanyDraft("hospitality", draft(), publicOccasion);
  const preset = { id: "hospitality", location: "New Orleans", occasion: "Default", context: {} };
  const profile = api.companyStartingProfile(preset, "?place=Boston&occasion=Before+the+show");
  assert.equal(profile.location, "Visitor's edited place");
  assert.equal(profile.occasion, "Visitor's edited afternoon");
  assert.equal(profile.context.scenario, draft().context.scenario);
  assert.deepEqual(profile.anchors, ["Nina Simone"]);
});

test("sign-in return destinations cannot redirect offsite or carry unknown credential parameters", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/api/company/admin/inquiries", "/not-a-route"]) {
    assert.equal(api.safeAppReturnTo(value), "/");
  }
  const destination = api.safeAppReturnTo("/companies/lab?type=hospitality&place=Boston&occasion=Afternoon&api_key=invented&redirect_url=https://evil.test");
  assert.equal(destination, "/companies/lab?type=hospitality&place=Boston&occasion=Afternoon");
  assert.equal(api.safeAppReturnTo("/companies/admin"), "/companies/admin");
  assert.equal(new URL(api.signInFor(destination), "https://example.test").searchParams.get("redirect_url"), destination);
});
