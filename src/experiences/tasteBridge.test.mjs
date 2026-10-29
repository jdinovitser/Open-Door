import test from "node:test";
import assert from "node:assert/strict";
import { bridgeAnchors, bridgeContributors, bridgeRouteDoors, createBridgeRequest, validateBridge } from "./tasteBridge.ts";

const interest = (label, category = "Music") => ({ id: label, label, category });
const person = (id, interests, name = `Private label ${id}`) => ({ id, name, interests });
const group = () => [person("a", [interest("Nina Simone")]), person("b", [interest("Spirited Away", "Film")])];

test("two to five people, each with a label and filled interests, are required", () => {
  assert.deepEqual(validateBridge(group(), 5), []);
  for (const people of [[], group().slice(0, 1), [...group(), ...group(), ...group()]]) {
    assert.match(validateBridge(people, 5).join(), /two to five/);
  }
  assert.match(validateBridge([person("a", []), group()[1]], 5).join(), /every person/);
  assert.match(validateBridge([person("a", [interest("")]), group()[1]], 5).join(), /empty interest/);
  assert.match(validateBridge([person("a", [interest("Jazz")], " "), group()[1]], 5).join(), /name or label/);
});

test("shared interests deduplicate without excluding any participant or mutating the input", () => {
  const people = [person("a", [interest("  Nina   Simone ")]), person("b", [interest("nina simone")])];
  const before = JSON.stringify(people);
  assert.equal(bridgeAnchors(people).length, 1);
  assert.equal(JSON.stringify(people), before);
  assert.deepEqual(validateBridge(people, 1), []);
  assert.equal(createBridgeRequest(people, "", "", 1).anchors.length, 1);
});

test("server anchor limits block over-budget requests rather than silently truncating", () => {
  const people = [person("a", ["A", "B", "C"].map(value => interest(value))), person("b", ["D", "E", "F"].map(value => interest(value)))];
  assert.equal(bridgeAnchors(people).length, 6);
  assert.match(validateBridge(people, 5).join(), /Remove 1/);
  assert.throws(() => createBridgeRequest(people, "", "", 5), /no interests will be dropped/);
  assert.equal(createBridgeRequest(people, "", "", 6).anchors.length, 6);
  assert.throws(() => createBridgeRequest(group(), "", "", 1), /at most 1/);
  const five = ["A", "B", "C", "D", "E"].map(label => person(label, [interest(label)]));
  assert.deepEqual(validateBridge(five, 5), []);
  assert.equal(createBridgeRequest(five, "", "", 5).anchors.length, 5);
});

test("ambiguous categories and overlength interests cannot be sent for silent normalization", () => {
  assert.match(validateBridge([person("a", [interest("Dune", "Film")]), person("b", [interest("dune", "Books")])], 5).join(), /same category/);
  assert.match(validateBridge([person("a", [interest("x".repeat(121))]), group()[1]], 5).join(), /120/);
});

test("request includes all typed cultural inputs, never names or participant metadata", () => {
  const request = createBridgeRequest(group(), " Brooklyn ", " Saturday ", 5);
  assert.deepEqual(request.anchors, [{ label: "Nina Simone", category: "Music" }, { label: "Spirited Away", category: "Film" }]);
  assert.equal(request.intent, "Find my people");
  assert.equal(request.depth, "Take me somewhere unexpected");
  assert.equal(request.location, "Brooklyn");
  assert.equal(request.occasion, "Saturday");
  assert.doesNotMatch(JSON.stringify(request), /Private label|person|interests|participants/);
});

test("attribution requires both resolution and the result's actual source entity ID", () => {
  const resolvedA = { label: "Nina Simone", category: "Music", entityId: "artist-a", entityName: "Nina Simone" };
  const resolvedB = { label: "Spirited Away", category: "Film", entityId: "film-b", entityName: "Spirited Away" };
  const journey = { resolvedAnchors: [resolvedA, resolvedB] };
  assert.deepEqual(bridgeContributors(group(), journey, { sourceEntityIds: ["artist-a"] }).map(person => person.personId), ["a"]);
  assert.deepEqual(bridgeContributors(group(), { resolvedAnchors: [] }, { sourceEntityIds: ["artist-a"] }), []);
  assert.deepEqual(bridgeContributors(group(), journey, {}), []);
  assert.deepEqual(bridgeContributors(group(), journey, { sourceEntityIds: ["unknown"] }), []);
});

test("shared resolved input credits both people; unresolved inputs and category mismatches get no credit", () => {
  const people = [person("a", [interest("Nina Simone"), interest("Unresolved")]), person("b", [interest("nina simone")]), person("c", [interest("Nina Simone", "Film")])];
  const journey = { resolvedAnchors: [{ label: "Nina Simone", category: "Music", entityId: "a", entityName: "Nina Simone" }] };
  const credits = bridgeContributors(people, journey, { sourceEntityIds: ["a"] });
  assert.deepEqual(credits.map(person => person.personId), ["a", "b"]);
  assert.equal(credits[0].interests.length, 1);
});

test("route slots reflect actual returned tiers, never fill missing slots or invent wild cards", () => {
  const journey = { doors: [
    { entityId: "a", tier: "Familiar" },
    { entityId: "b", tier: "Unexpected", unexpectedCrossCategory: false },
    { entityId: "c", tier: "Unexpected", unexpectedCrossCategory: true },
    { tier: "Adjacent" },
  ] };
  assert.equal(bridgeRouteDoors(journey, "Familiar")[0].entityId, "a");
  assert.deepEqual(bridgeRouteDoors(journey, "Adjacent"), []);
  assert.deepEqual(bridgeRouteDoors(journey, "Unexpected").map(door => door.entityId), ["c"]);
  assert.deepEqual(bridgeRouteDoors({ doors: [] }, "Familiar"), []);
});
