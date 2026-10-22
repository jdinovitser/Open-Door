import test from "node:test";
import assert from "node:assert/strict";
import { allDiscoveries, anchorDiscovery, compareBranches, createBranch, deleteBranch, emptyLab, forkDiscovery, freshLab, parseLab, recordResults, renameItem, replaceCurrent, restoreCheckpoint, resumeBranch, saveCheckpoint, seedLab } from "../src/lab/engine.ts";
import { createDemoProvider } from "../src/lab/demoProvider.ts";
import { createLiveProvider, liveRequest } from "../src/lab/liveProvider.ts";
import { journeyToLab } from "../src/lab/journeyAdapter.ts";
import { STRATEGIES } from "../src/lab/model.ts";

const date = "2026-10-20T18:00:00Z";
const seed = () => ({
  anchors: ["experimental jazz", "short films"], categories: { "experimental jazz": "Music", "short films": "Film" },
  location: "Brooklyn", context: { time: "An afternoon", budget: "No purchase", movement: "Mostly seated", conditions: "Quiet" },
  mode: "demo", discoveries: [], feedback: {},
});
const base = snapshot => [
  { category: snapshot.settings.adventure === "unexpected" ? "Books" : "Music", title: "Original sample", evidence: "Authored sample" },
  { category: "Art", title: "Original sample two", evidence: "Authored sample" },
  { category: "Food", title: "Original sample three", evidence: "Authored sample" },
];
const provider = createDemoProvider(base);
test("a new branch cannot display inherited checkpoint candidates as its own discoveries", () => {
  const populated = seed();
  populated.discoveries = [{ id: "old", title: "Earlier result", mode: "demo" }];
  const saved = saveCheckpoint(seedLab(emptyLab(), populated), "Shared", "root", date);
  const branched = createBranch(saved, "root", "stay", "new", date);
  assert.deepEqual(branched.current.candidates, []);
  assert.equal(branched.checkpoints[0].snapshot.candidates[0].title, "Earlier result");
});
test("comparison separates new branch discoveries from shared checkpoint ancestry", async () => {
  const parent = await explored();
  const saved = saveCheckpoint(parent, "Later start", "later", date);
  const checkpoint = saved.checkpoints.find(item => item.id === "later");
  const branched = createBranch(saved, "later", "wild", "child", date);
  assert.deepEqual(allDiscoveries(branched.branches[1], checkpoint), []);
  const result = await provider.discover({ snapshot: branched.current, strategy: "wild" });
  const finished = recordResults(branched, result, "child-step", date);
  assert.deepEqual(allDiscoveries(finished.branches[1], checkpoint).map(item => item.id), result.discoveries.map(item => item.id));
  assert.deepEqual(finished.branches[0], parent.branches[0]);
});
test("live Lab domains request Qloo entity types without discarding normalized place or brand categories", async () => {
  const expected = {
    Music: ["artist", "podcast"], Film: ["movie", "tv_show"], Books: ["book"],
    Food: ["place", "brand"], Fashion: ["brand"], Architecture: ["place", "brand"],
    Art: ["person", "artist"], Places: ["place", "destination"],
  };
  for (const [domain, types] of Object.entries(expected)) {
    let captured;
    const live = createLiveProvider(async request => {
      captured = request;
      return { mode: "live", notices: [], doors: types.map(type => ({
        id: type, entityId: `entity-${type}`, entityType: type,
        title: `Returned ${type}`, category: type === "place" ? "Experiences" : type === "brand" ? "Design" : "Music",
        description: "Returned by the test provider", why: "Recorded connection", evidence: "Fixture evidence",
        source: "Fixture", tier: "Adjacent", thread: "A connection",
      })) };
    });
    const snapshot = seedLab(emptyLab(), { ...seed(), mode: "live" }).current;
    snapshot.settings.domain = domain;
    const result = await live.discover({ snapshot, strategy: "cross" });
    assert.deepEqual(captured.resultTypes, types, domain);
    assert.equal(result.discoveries.length, types.length, domain);
    assert.ok(result.discoveries.every(item => item.mode === "live"));
  }
});
test("people and practical live branches request places without asserting social or access suitability", () => {
  const snapshot = seedLab(emptyLab(), { ...seed(), mode: "live" }).current;
  for (const strategy of ["people", "real"]) {
    assert.deepEqual(liveRequest(snapshot, strategy).resultTypes, ["place", "destination"]);
  }
  assert.equal(liveRequest(snapshot, "wild").resultTypes, undefined);
});
function checkpointed() { return saveCheckpoint(seedLab(emptyLab(), seed()), "Common start", "cp", date); }
async function explored(strategy = "stay", id = "a", state = checkpointed()) {
  const branched = createBranch(state, "cp", strategy, id, date);
  const result = await provider.discover({ snapshot: branched.current, strategy });
  return recordResults(branched, result, `step-${id}`, date);
}
test("checkpoint preserves a deep snapshot including settings, feedback, candidates and ancestry", async () => {
  const state = await explored();
  const saved = saveCheckpoint(state, "After a discovery", "cp2", date);
  const edited = replaceCurrent(saved, { ...saved.current, settings: { ...saved.current.settings, budget: "Changed" }, feedback: { x: { action: "keep", reason: "Kept" } } });
  const restored = restoreCheckpoint(edited, "cp2");
  assert.deepEqual(restored.current, state.current);
  assert.equal(restored.activeBranchId, null);
  assert.equal(saved.checkpoints[1].parentBranchId, "a");
  assert.equal(saved.checkpoints[1].parentCheckpointId, "cp");
});
test("branch exploration cannot mutate a sibling or the shared checkpoint", async () => {
  const a = await explored();
  const siblingBefore = JSON.stringify(a.branches[0]);
  const rootBefore = JSON.stringify(a.checkpoints[0]);
  const b = await explored("wild", "b", a);
  const chosen = b.current.candidates[0];
  const continued = anchorDiscovery(b, chosen);
  const result = await provider.discover({ snapshot: continued.current, strategy: "wild" });
  const final = recordResults(continued, result, "step-next", date);
  assert.equal(JSON.stringify(final.branches[0]), siblingBefore);
  assert.equal(JSON.stringify(final.checkpoints[0]), rootBefore);
  assert.equal(final.branches[1].snapshot.history.length, 2);
  assert.equal(final.branches[0].snapshot.history.length, 1);
  assert.deepEqual(resumeBranch(final, "a").current, a.current);
});
test("continuing uses a selected discovery as the next anchor and preserves original preferences", async () => {
  const state = await explored();
  const discovery = state.current.candidates[0];
  const next = anchorDiscovery(state, discovery);
  assert.deepEqual(next.current.anchors, [discovery.title]);
  assert.deepEqual(next.current.originalAnchors, seed().anchors);
  assert.deepEqual(next.current.originalContext, seed().context);
  const result = await provider.discover({ snapshot: next.current, strategy: "stay" });
  assert.match(result.discoveries[0].connection, new RegExp(discovery.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.notDeepEqual(result.discoveries.map(d => d.title), state.current.candidates.map(d => d.title));
});
test("forking creates a child checkpoint without changing its parent's current snapshot", async () => {
  const state = await explored();
  const previous = JSON.stringify(state.branches[0]);
  const forked = forkDiscovery(state, state.current.candidates[1], "child", date);
  assert.equal(JSON.stringify(forked.branches[0]), previous);
  assert.equal(forked.activeBranchId, null);
  assert.equal(forked.checkpoints[1].parentBranchId, "a");
  assert.equal(forked.current.selected.id, state.current.candidates[1].id);
  assert.equal(forked.current.history.length, state.current.history.length);
  const childBranch = createBranch(forked, "child", "cross", "child-b", date);
  assert.deepEqual(childBranch.current.anchors, [state.current.candidates[1].title]);
});
test("comparison includes only selected siblings from the same checkpoint", async () => {
  const a = await explored();
  const b = await explored("cross", "b", a);
  const forked = forkDiscovery(b, b.current.candidates[0], "child", date);
  const child = createBranch(forked, "child", "thread", "c", date);
  assert.deepEqual(compareBranches(child, "cp", ["a", "b", "c"]).map(b => b.id), ["a", "b"]);
  assert.ok(allDiscoveries(child.branches[0]).length > 0);
});
test("all six strategies produce distinct demo batches with no fabricated live evidence", async () => {
  const signatures = [];
  for (const strategy of STRATEGIES) {
    const state = await explored(strategy.id);
    assert.equal(state.current.candidates.length, 3);
    assert.ok(state.current.candidates.every(d => d.mode === "demo" && /no Qloo data/.test(d.source)));
    signatures.push(state.current.candidates.map(d => d.title).join("|"));
    if (strategy.id === "stay") assert.ok(state.current.candidates.every(d => d.domain === "Music"));
    if (strategy.id === "cross" || strategy.id === "wild") assert.ok(state.current.candidates.some(d => d.domain !== "Music"));
    if (strategy.id === "real") assert.ok(state.current.candidates.every(d => d.plan.length === 3 && d.plan.join(" ").includes("Brooklyn")));
  }
  assert.equal(new Set(signatures).size, 6);
});
test("domain, mood, time, group preferences and new anchors are reflected in demo output", async () => {
  const state = createBranch(checkpointed(), "cp", "people", "a", date);
  const snapshot = { ...state.current, settings: { ...state.current.settings, domain: "Architecture", mood: "Cozy", time: "Weekend", occasion: "Family activity", groupInterests: "paper models" } };
  const result = await provider.discover({ snapshot, strategy: "people" });
  assert.ok(result.discoveries.every(d => d.domain === "Architecture"));
  assert.match(result.discoveries[0].description, /Cozy.*family activity.*paper models/);
  assert.ok(result.discoveries[0].constraints.some(c => c.value === "Weekend"));
  const changed = await provider.discover({ snapshot: { ...snapshot, anchors: ["poetry"] }, strategy: "people" });
  assert.notEqual(result.discoveries[0].id, changed.discoveries[0].id);
});
test("previously shown candidates are excluded until the finite demo collection is exhausted", async () => {
  let state = createBranch(checkpointed(), "cp", "stay", "a", date);
  const seen = new Set();
  let reachedEmpty = false;
  for (let index = 0; index < 10; index++) {
    const result = await provider.discover({ snapshot: state.current, strategy: "stay" });
    for (const discovery of result.discoveries) { assert.ok(!seen.has(discovery.id)); seen.add(discovery.id); }
    state = recordResults(state, result, `step-${index}`, date);
    if (!result.discoveries.length) { reachedEmpty = true; break; }
  }
  assert.ok(reachedEmpty);
});
test("rename, delete and fresh exploration preserve checkpoints and sibling histories", async () => {
  let state = await explored();
  state = await explored("thread", "b", state);
  state = renameItem(state, "branch", "b", "My thread");
  state = renameItem(state, "checkpoint", "cp", "Home");
  assert.equal(state.branches[1].name, "My thread");
  state = { ...state, favorites: { cp: "b" } };
  const deleted = deleteBranch(state, "b");
  assert.equal(deleted.branches.length, 1);
  assert.equal(deleted.favorites.cp, undefined);
  assert.equal(deleted.checkpoints[0].name, "Home");
  assert.equal(freshLab(state).branches.length, 2);
  assert.equal(freshLab(state).current, null);
  assert.throws(() => renameItem(state, "branch", "a", " "), /name/);
});
test("persistence roundtrip restores complete branch state and rejects corrupt or missing data", async () => {
  const state = await explored();
  assert.deepEqual(parseLab(JSON.stringify(state)), state);
  assert.deepEqual(parseLab(null), emptyLab());
  for (const value of ["{", "null", "[]", JSON.stringify({ ...state, current: {} }), JSON.stringify({ ...state, branches: [{ ...state.branches[0], checkpointId: "missing" }] })]) {
    assert.throws(() => parseLab(value));
  }
  assert.throws(() => parseLab(JSON.stringify({ ...state, current: { ...state.current, settings: { ...state.current.settings, mood: "Imagined" } } })));
});
test("provider errors do not change the state and live never substitutes demo data", async () => {
  const state = await explored();
  const before = JSON.stringify(state);
  const live = createLiveProvider(async () => { throw new Error("Qloo unavailable"); });
  await assert.rejects(live.discover({ snapshot: { ...state.current, mode: "live" }, strategy: "thread" }), /Qloo unavailable/);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => recordResults(state, { mode: "live", discoveries: [], notices: [] }, "bad", date), /provenance/);
});
test("live adapter uses existing request normalization, selected entity IDs, feedback and exclusions", async () => {
  const state = await explored();
  const discovery = { ...state.current.candidates[0], mode: "live", entityId: "entity-returned", entityType: "urn:entity:artist" };
  const snapshot = { ...state.current, mode: "live", anchors: [discovery.title], selected: discovery, feedback: { one: { action: "reject", reason: "Too expensive" } }, history: [{ ...state.current.history[0], discoveries: [discovery] }] };
  const request = liveRequest(snapshot, "people");
  assert.equal(request.intent, "Find my people");
  assert.equal(request.resolvedEntities[0].entityId, discovery.entityId);
  assert.ok(request.excludedEntityIds.includes(discovery.entityId));
  assert.deepEqual(request.feedback, ["Too expensive"]);
});
test("original journey import preserves selected discovery, constraints and provenance", () => {
  const source = { anchors: ["jazz"], categories: { jazz: "Music" }, city: "Brooklyn", context: { time: "Weekend", budget: "Free" }, occasion: "Weekend", intent: "Go deeper", depth: "Close to home", doors: [{ id: "old", title: "A listening ritual", category: "Music", kind: "Sound", why: "Authored analogy", evidence: "Demo only", thread: "Listening", source: "jazz", tier: "Familiar", entityId: "must-not-leak-as-live", entityType: "artist" }] };
  const imported = journeyToLab(source, "old", { old: "Too expensive" }, "books; jazz");
  assert.equal(imported.mode, "demo");
  assert.equal(imported.selected.entityId, undefined);
  assert.equal(imported.selected.constraints.length, 5);
  const snapshot = seedLab(emptyLab(), imported).current;
  assert.deepEqual(snapshot.originalAnchors, ["jazz"]);
  assert.deepEqual(snapshot.anchors, ["A listening ritual"]);
  assert.equal(snapshot.settings.adventure, "familiar");
  assert.equal(snapshot.settings.occasion, "Social gathering");
  assert.equal(snapshot.originalContext.intent, "Go deeper");
  assert.equal(snapshot.feedback.old.reason, "Too expensive");
});
test("empty and cancelled discovery are explicit rather than invented results", async () => {
  const state = createBranch(checkpointed(), "cp", "stay", "a", date);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(provider.discover({ snapshot: state.current, strategy: "stay", signal: controller.signal }), { name: "AbortError" });
  const next = recordResults(state, { mode: "demo", discoveries: [], notices: ["None remain"] }, "empty", date);
  assert.deepEqual(next.current.candidates, []);
  assert.equal(next.current.history.length, 1);
});
