import test from "node:test";
import assert from "node:assert/strict";
import { emptyLab, preserveComparison, seedLab, saveCheckpoint, parseLab, compareBranches, resumeBranch, allDiscoveries } from "../src/lab/engine.ts";
import { requestFromJourney, referenceToLab, whatIfFromJourney } from "../src/experiences/journeyHandoff.ts";

const time = "2026-10-30T12:00:00Z";
const seed = (title = "Original", mode = "live") => ({
  anchors: ["Nina Simone"], categories: { "Nina Simone": "Music" }, location: "Brooklyn",
  context: { time: "Saturday" }, mode, feedback: {},
  discoveries: [{ id: title, title, domain: "Music", mode, entityId: mode === "live" ? title : undefined,
    evidence: mode === "live" ? "Qloo returned result" : "Authored example", constraints: [],
    description: "", connection: "", originalConnection: "", source: "", selection: "" }],
});
test("comparison import retains prior Lab checkpoints and adds two independent sibling histories without querying", () => {
  const prior = saveCheckpoint(seedLab(emptyLab(), seed("Earlier")), "Keep me", "earlier", time);
  const before = JSON.stringify(prior);
  const first = seed(); const second = seed("Alternative");
  const state = preserveComparison(prior, first, second, ["root", "a", "b", "step-a", "step-b"], time);
  assert.equal(JSON.stringify(prior), before);
  assert.equal(state.checkpoints[0].id, "earlier");
  assert.equal(state.branches.length, 2);
  assert.equal(compareBranches(state, "root", ["a", "b"]).length, 2);
  assert.equal(state.branches[0].snapshot.history[0].discoveries[0].title, "Original");
  assert.equal(state.branches[1].snapshot.history[0].discoveries[0].title, "Alternative");
  assert.equal(allDiscoveries(state.branches[1], state.checkpoints[1])[0].title, "Alternative");
  assert.equal(resumeBranch(state, "a").current.candidates[0].title, "Original");
  assert.equal(parseLab(JSON.stringify(state)).branches.length, 2);
  state.branches[1].snapshot.history[0].discoveries[0].title = "Changed";
  assert.equal(state.branches[0].snapshot.history[0].discoveries[0].title, "Original");
  assert.equal(second.discoveries[0].title, "Alternative");
});
test("comparison respects storage limits and mixed historical prepared/live provenance", () => {
  const state = preserveComparison(emptyLab(), seed("Example", "demo"), seed("Live"), ["r", "a", "b", "x", "y"], time);
  assert.equal(state.branches[0].snapshot.mode, "demo");
  assert.equal(state.branches[1].snapshot.mode, "live");
  assert.throws(() => preserveComparison({ ...emptyLab(), branches: Array(99).fill({}) }, seed(), seed(), ["r", "a", "b", "x", "y"], time), /Remove unused/);
  assert.throws(() => preserveComparison(emptyLab(), seed(), seed(), ["r"], time), /unique identifiers/);
});
test("journey handoffs retain entity continuity and public inputs without participant labels", () => {
  const journey = { city: "Brooklyn", occasion: "Saturday", intent: "Find my people", depth: "A little further",
    context: { budget: "Flexible" }, anchors: ["Nina Simone"], categories: { "Nina Simone": "Music" },
    resolvedAnchors: [{ label: "Nina Simone", category: "Music", entityId: "nina", entityType: "artist" }],
    feedbackApplied: [], iteration: 0, doors: [{ id: "d", title: "Returned film", category: "Film", entityId: "film", tier: "Adjacent" }],
    people: [{ name: "Private participant label" }],
  };
  const request = requestFromJourney(journey);
  assert.equal(request.resolvedEntities[0].entityId, "nina");
  assert.deepEqual(requestFromJourney(journey, true).excludedEntityIds, ["film"]);
  assert.equal(request.excludedEntityIds, undefined);
  assert.doesNotMatch(JSON.stringify(request), /Private participant/);
  const start = whatIfFromJourney(journey, "handoff");
  assert.equal(start.doors[0].entityId, "film");
  const preserved = referenceToLab(start);
  assert.equal(preserved.discoveries[0].entityId, "film");
  assert.match(preserved.discoveries[0].evidence, /not a new API request/);
  assert.equal(preserved.discoveries[0].entityType, undefined);
  start.doors[0].title = "Changed after handoff";
  assert.equal(journey.doors[0].title, "Returned film");
});
