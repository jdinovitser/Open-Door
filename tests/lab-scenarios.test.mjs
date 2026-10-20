import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, scenarioGuidance } from "../src/lab/scenarios.ts";
import { emptyLab, seedLab, parseLab, saveCheckpoint, createBranch, replaceCurrent, restoreCheckpoint } from "../src/lab/engine.ts";
import { createDemoProvider } from "../src/lab/demoProvider.ts";
import { createLiveProvider, liveRequest } from "../src/lab/liveProvider.ts";

const seed = {
  anchors: ["jazz"], categories: { jazz: "Music" }, location: "", context: {},
  mode: "demo", discoveries: [], feedback: {},
};
const demo = createDemoProvider(() => []);

for (const scenario of SCENARIOS) {
  test(`${scenario.label}: editable scenario survives checkpoints, branches and reloads`, async () => {
    const state = seedLab(emptyLab(), {
      ...seed, context: { scenarioCategory: scenario.id, scenario: scenario.example },
    });
    const checkpoint = saveCheckpoint(state, "Starting point", "cp", "2026-10-20");
    const branch = createBranch(checkpoint, "cp", "stay", "branch", "2026-10-20");
    assert.equal(branch.current.settings.scenario, scenario.example);
    const result = await demo.discover({ snapshot: branch.current, strategy: "stay" });
    assert.equal(result.discoveries.length, 3);
    for (const discovery of result.discoveries) {
      assert.ok(discovery.plan.length);
      assert.equal(discovery.constraints.at(-1).value, scenario.example);
      assert.equal(discovery.mode, "demo");
    }
    const edited = replaceCurrent(branch, {
      ...branch.current, settings: { ...branch.current.settings, scenario: "No walking and a short session, on my own." },
    });
    assert.equal(parseLab(JSON.stringify(edited)).current.settings.scenario, edited.current.settings.scenario);
    assert.equal(restoreCheckpoint(edited, "cp").current.settings.scenario, scenario.example);
    assert.equal(edited.checkpoints[0].snapshot.settings.scenario, scenario.example);
  });
}

test("adaptations follow explicit circumstances, not category, age or diagnosis", () => {
  const settings = seedLab(emptyLab(), seed).current.settings;
  const quiet = scenarioGuidance({ ...settings, scenarioCategory: "age-aware", scenario: "Quiet and seated with a small budget." });
  assert.ok(quiet.some(item => item.includes("silent")));
  assert.ok(quiet.some(item => item.includes("seated")));
  assert.ok(quiet.some(item => item.includes("free access")));
  assert.deepEqual(quiet, scenarioGuidance({ ...settings, scenarioCategory: "personal-style", scenario: "Quiet and seated with a small budget." }));
  const ageOnly = scenarioGuidance({ ...settings, scenarioCategory: "age-aware", scenario: "I am 75 and want a new experience." });
  assert.equal(ageOnly.length, 1);
  assert.ok(!ageOnly.join(" ").includes("seated"));
  const different = scenarioGuidance({ ...settings, scenarioCategory: "age-aware", scenario: "I enjoy energetic group experiences." });
  assert.ok(!different.join(" ").includes("silent"));
  assert.deepEqual(scenarioGuidance(settings), []);
  const negated = scenarioGuidance({ ...settings, scenario: "I don't want a quiet experience. I do not need a seated option." });
  assert.ok(!negated.join(" ").includes("silent reading"));
  assert.ok(!negated.join(" ").includes("seated or at-home"));
});

test("live results get local adaptations without sending the scenario upstream", async () => {
  const privateBrief = "Quiet, seated, flexible timing.";
  const state = seedLab(emptyLab(), { ...seed, mode: "live", context: { scenario: privateBrief, scenarioCategory: "wellbeing" } });
  assert.ok(!JSON.stringify(liveRequest(state.current, "stay")).includes(privateBrief));
  let request;
  const live = createLiveProvider(async value => {
    request = value;
    return { mode: "live", notices: [], doors: [{
      id: "live-one", title: "A cultural discovery", category: "Music", description: "Provider description.",
      why: "Provider evidence.", tier: "Familiar", thread: "Music", entityId: "one", entityType: "artist",
    }] };
  });
  const result = await live.discover({ snapshot: state.current, strategy: "stay" });
  assert.ok(!JSON.stringify(request).includes(privateBrief));
  assert.equal(result.discoveries[0].mode, "live");
  assert.ok(result.discoveries[0].plan.some(item => item.includes("seated")));
  assert.equal(result.discoveries[0].connection, "Provider evidence.");
});

test("old Lab data remains readable; malformed or oversized scenarios are rejected", () => {
  const state = seedLab(emptyLab(), seed);
  assert.deepEqual(parseLab(JSON.stringify(state)), state);
  state.current.settings.scenario = "x".repeat(1001);
  assert.throws(() => parseLab(JSON.stringify(state)), /invalid/);
  state.current.settings.scenario = "An editable brief";
  state.current.settings.scenarioCategory = "unsupported-category";
  assert.throws(() => parseLab(JSON.stringify(state)), /invalid/);
});
