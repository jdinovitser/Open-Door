import test from "node:test";
import assert from "node:assert/strict";
import { runDiscovery } from "./agent.js";

const request = { anchors: [{ label: "Nina Simone", category: "Music" }], intent: "Try something new", depth: "A little further", location: "Brooklyn", context: { budget: "Moderate", movement: "Easy walking" } };
const entity = (id, properties = {}) => ({ entity_id: id, name: id, properties });
function client(results) {
  return {
    searchEntities: async () => [entity("seed")],
    getInsights: async type => ({ entities: results[type] || [] }),
  };
}

test("Unexpected prioritizes an unused cross-category candidate from retrieved results without changing Familiar/Adjacent", async () => {
  const journey = await runDiscovery({ ...request, resultTypes: ["artist", "book", "podcast"] }, {
    qloo: client({ artist: [entity("seed"), entity("familiar")], book: [entity("adjacent"), entity("cross-category")], podcast: [entity("music-podcast")] }),
  });
  assert.deepEqual(journey.doors.map(d => d.entityId), ["familiar", "adjacent", "cross-category"]);
  assert.equal(journey.doors[2].category, "Books");
  assert.equal(journey.doors[2].unexpectedCrossCategory, true);
  assert.equal(journey.doors[2].discoveryDistance.isQlooScore, false);
});

test("Unexpected falls back honestly within the available category and excludes seeds, prior results, and duplicate doors", async () => {
  const journey = await runDiscovery({ ...request, resultTypes: ["artist"], excludedEntityIds: ["seen"] }, {
    qloo: client({ artist: ["seed", "seen", "a", "a", "b", "c"].map(id => entity(id)) }),
  });
  assert.deepEqual(journey.doors.map(d => d.entityId), ["a", "b", "c"]);
  assert.equal(journey.doors[2].unexpectedCrossCategory, false);
  assert.match(journey.doors[2].discoveryDistance.rationale, /not a claim of unexpectedness/);
});

test("insufficient distinct results stay partial and seed-only results fail rather than becoming examples", async () => {
  const partial = await runDiscovery({ ...request, resultTypes: ["artist"] }, { qloo: client({ artist: [entity("seed"), entity("only")] }) });
  assert.equal(partial.mode, "live");
  assert.equal(partial.doors.length, 1);
  await assert.rejects(runDiscovery(request, { qloo: client({ artist: [entity("seed")] }) }), { code: "NO_CANDIDATES" });
});

test("only source-provided HTTPS websites and valid coordinates survive; missing evidence remains missing", async () => {
  const journey = await runDiscovery({ ...request, resultTypes: ["place"] }, {
    qloo: client({ place: [
      entity("good", { website: "https://example.org/visit", geocode: { latitude: 40.7, longitude: -73.9 } }),
      entity("missing", { website: "javascript:alert(1)", geocode: { latitude: null, longitude: null } }),
      entity("invalid", { geocode: { latitude: 99, longitude: 0 } }),
    ] }),
  });
  assert.equal(journey.doors[0].websiteUrl, "https://example.org/visit");
  assert.deepEqual(journey.doors[0].coordinates, { latitude: 40.7, longitude: -73.9 });
  assert.equal(journey.doors[1].websiteUrl, "");
  assert.equal(journey.doors[1].coordinates, null);
  assert.equal(journey.doors[2].coordinates, null);
  assert.equal(journey.doors[1].explainability, null);
});
