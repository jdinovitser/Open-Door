import test from "node:test";
import assert from "node:assert/strict";
import { applyWhatIfMappings, compareWhatIfResults, controlsFor, createWhatIfRequest, interpretWhatIf, practicalWhatIfNotes, snapshotStart, validateWhatIf, whatIfChanges } from "./whatIf.ts";

const start = () => ({
  id: "original", origin: "journey", label: "Original journey", mode: "live",
  request: { location: "Brooklyn", occasion: "Saturday", intent: "Try something new", depth: "A little further",
    anchors: [{ label: "Nina Simone", category: "Music" }],
    resolvedEntities: [{ label: "Nina Simone", category: "Music", entityId: "seed-1", entityType: "artist" }],
    context: { time: "Saturday", budget: "Flexible", movement: "Open to anything", conditions: "Open to anything" }, feedback: [], iteration: 0 },
  doors: [{ id: "qloo-original", entityId: "original", title: "Original artist", category: "Music" }],
});

test("explicit natural-language rules produce previewable field mappings without applying them", () => {
  const controls = controlsFor(start().request);
  const parsed = interpretWhatIf("What if I only have two hours? I have a smaller budget. I want a relaxed experience. I am exploring in Paris. I want to go deeper. I want something completely different.");
  assert.deepEqual(parsed.mappings.map(item => item.field), ["time", "budget", "movement", "location", "intent", "depth"]);
  assert.equal(controls.time, "Saturday");
  const applied = applyWhatIfMappings(controls, parsed.mappings);
  assert.equal(applied.time, "2 hours");
  assert.equal(applied.budget, "Lower cost");
  assert.equal(applied.movement, "Mostly seated");
  assert.equal(applied.location, "Paris");
  assert.equal(applied.intent, "Go deeper");
  assert.equal(applied.depth, "Take me somewhere unexpected");
});

test("negations, vague requests, sensitive prose and compound statements are never inferred", () => {
  const parsed = interpretWhatIf("I don't want a smaller budget. I have no money. My private medical note. I am exploring in Paris or Rome. I want something completely different but not music.");
  assert.deepEqual(parsed.mappings, []);
  assert.equal(parsed.unrecognized.length, 5);
  assert.deepEqual(interpretWhatIf("").mappings, []);
});

test("children and less-touristy requests yield only honest local planning notes", () => {
  const parsed = interpretWhatIf("I am traveling with children. I want something less touristy.");
  assert.equal(parsed.localNotes.length, 2);
  assert.deepEqual(parsed.mappings, []);
  assert.match(parsed.localNotes.join(), /not verified|do not establish/);
});

test("conflicts apply in explicit written order and manual overrides remain editable", () => {
  const parsed = interpretWhatIf("I only have two hours. I only have four hours.");
  const applied = applyWhatIfMappings(controlsFor(start().request), parsed.mappings);
  assert.equal(applied.time, "4 hours");
  applied.time = "3 hours";
  assert.equal(createWhatIfRequest(start(), applied, 5, 1).context.time, "3 hours");
});

test("source snapshot and request are independent of original preferences and later edits", () => {
  const source = start();
  const before = JSON.stringify(source);
  const snapshot = snapshotStart(source);
  const controls = { ...controlsFor(snapshot.request), location: "Lisbon", budget: "Lower cost" };
  const request = createWhatIfRequest(snapshot, controls, 5, 1);
  assert.equal(JSON.stringify(source), before);
  assert.equal(snapshot.request.location, "Brooklyn");
  assert.equal(request.location, "Lisbon");
  request.anchors[0].label = "Edited returned request";
  source.doors[0].title = "Later source edit";
  assert.equal(snapshot.request.anchors[0].label, "Nina Simone");
  assert.equal(snapshot.doors[0].title, "Original artist");
});

test("existing entity seeds, categories, exclusions and public conditions survive alternative controls", () => {
  const source = start();
  source.request.excludedEntityIds = ["previous"];
  const next = createWhatIfRequest(source, { ...controlsFor(source.request), time: "2 hours", movement: "Mostly seated" }, 5, 2);
  assert.deepEqual(next.resolvedEntities, source.request.resolvedEntities);
  assert.deepEqual(next.anchors, source.request.anchors);
  assert.deepEqual(next.excludedEntityIds, ["previous"]);
  assert.equal(next.context.conditions, "Open to anything");
  assert.equal(next.occasion, "2 hours");
  assert.equal(next.iteration, 2);
  assert.equal("scenario" in next.context, false);
});

test("limits reject empty, duplicate, overlength and over-budget interests without truncating", () => {
  const source = start();
  source.request.anchors = [];
  assert.throws(() => createWhatIfRequest(source, controlsFor(source.request), 5, 1), /at least one/);
  source.request.anchors = Array.from({ length: 6 }, (_, index) => ({ label: `Name ${index}`, category: "Books" }));
  assert.throws(() => createWhatIfRequest(source, controlsFor(source.request), 5, 1), /none will be silently dropped/);
  assert.equal(source.request.anchors.length, 6);
  source.request.anchors = [{ label: "Nina Simone", category: "Music" }, { label: " nina   simone ", category: "Music" }];
  assert.match(validateWhatIf(source, controlsFor(source.request), 5).join(), /duplicate/);
  source.request.anchors = [{ label: "x".repeat(121), category: "Music" }];
  assert.match(validateWhatIf(source, controlsFor(source.request), 5).join(), /120/);
});

test("unsupported routing controls cannot become API requests", () => {
  assert.throws(() => createWhatIfRequest(start(), { ...controlsFor(start().request), depth: "Invent a score" }, 5, 1), /supported depth/);
  assert.throws(() => createWhatIfRequest(start(), { ...controlsFor(start().request), intent: "Medical suitability" }, 5, 1), /supported intent/);
});

test("a changed time brief clears stale inherited windows, while unchanged time retains them", () => {
  const source = start();
  source.request.context.startTime = "09:00";
  source.request.context.endTime = "17:00";
  const baseline = createWhatIfRequest(source, controlsFor(source.request), 5, 1);
  assert.equal(baseline.context.startTime, "09:00");
  const changed = createWhatIfRequest(source, { ...controlsFor(source.request), time: "2 hours" }, 5, 2);
  assert.equal("startTime" in changed.context, false);
  assert.equal("endTime" in changed.context, false);
  assert.equal(source.request.context.endTime, "17:00");
});

test("change summary separates Qloo routing from practical context, not fabricated causality", () => {
  const original = start();
  const controls = { ...controlsFor(original.request), location: "Paris", depth: "Surprise me", budget: "Lower cost", time: "2 hours", movement: "Mostly seated" };
  const changes = whatIfChanges(original.request, createWhatIfRequest(original, controls, 5, 1));
  assert.deepEqual(changes.filter(item => item.scope === "routing").map(item => item.field), ["location", "depth"]);
  assert.deepEqual(changes.filter(item => item.scope === "local").map(item => item.field), ["budget", "time", "movement"]);
  assert.deepEqual(whatIfChanges(original.request, createWhatIfRequest(original, controlsFor(original.request), 5, 1)), []);
});

test("actual entity-ID comparison handles retained, new, missing, and empty alternatives", () => {
  const original = start();
  assert.deepEqual(compareWhatIfResults(original, { doors: [{ entityId: "original" }, { entityId: "new" }] }),
    { comparable: true, retained: 1, added: 1, missing: 0 });
  assert.deepEqual(compareWhatIfResults(original, { doors: [] }),
    { comparable: true, retained: 0, added: 0, missing: 1 });
  original.mode = "demo";
  assert.equal(compareWhatIfResults(original, { doors: [{ entityId: "original" }] }).comparable, false);
});

test("practical guidance explicitly rejects fabricated time, price, and access verification", () => {
  const notes = practicalWhatIfNotes(controlsFor(start().request)).join(" ");
  assert.match(notes, /No duration has been verified/);
  assert.match(notes, /not price-filtered/);
  assert.match(notes, /Mobility suitability is not verified/);
});
