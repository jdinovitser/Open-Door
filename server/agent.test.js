import assert from "node:assert/strict";
import test from "node:test";
import { AgentRequestError, runDiscovery, validateDiscoveryRequest } from "./agent.js";

function fakeQloo({ emptyInsightTypes = [], unresolved = false } = {}) {
  const calls = { searches: [], insights: [] };
  const qloo = {
    async searchEntities(query, entityType) {
      calls.searches.push({ query, entityType });
      if (unresolved) return [];
      return [{ entity_id: `source-${entityType}-${query.replaceAll(" ", "-")}`, name: query }];
    },
    async getInsights(entityType, entityIds, location) {
      calls.insights.push({ entityType, entityIds, location });
      if (emptyInsightTypes.includes(entityType)) return { entities: [] };
      return {
        entities: [{
          entity_id: `candidate-${entityType}`,
          name: `A ${entityType} discovery`,
          subtype: `urn:entity:${entityType}`,
          popularity: 0.74,
          properties: { description: "Description from the Qloo response." },
          query: { explainability: { matched_entities: entityIds } },
        }],
        query: { explainability: { input_count: entityIds.length } },
      };
    },
  };
  return { qloo, calls };
}

const request = {
  location: "Brooklyn, New York",
  occasion: "A free Saturday",
  intent: "Try something new",
  depth: "A little further",
  context: { time: "A free Saturday", budget: "Free or low-cost", movement: "Easy walking", conditions: "Social setting" },
  anchors: [
    { label: "independent cinema", category: "Film" },
    { label: "live jazz", category: "Music" },
    { label: "Japanese breakfast", category: "Food" },
  ],
};
test("Lab result types are validated and repeated route types reuse a single Qloo response", async () => {
  assert.throws(() => validateDiscoveryRequest({ ...request, resultTypes: ["unsupported-type"] }), /supported Qloo result types/);
  assert.throws(() => validateDiscoveryRequest({ ...request, resultTypes: [] }), /supported Qloo result types/);
  const { qloo, calls } = fakeQloo();
  const journey = await runDiscovery({ ...request, resultTypes: ["book"] }, { qloo });
  assert.equal(calls.insights.length, 1);
  assert.ok(calls.insights.every(item => item.entityType === "book"));
  assert.ok(journey.doors.length > 0);
  assert.ok(journey.doors.every(door => door.entityType === "book"));
  assert.ok(journey.doors.every(door => door.discoveryDistance.isQlooScore === false));
});

test("the live agent resolves anchors, makes multiple Qloo insight queries, and returns provenance", async () => {
  const { qloo, calls } = fakeQloo();
  const events = [];
  const journey = await runDiscovery(request, { qloo, emit: event => events.push(event) });

  assert.equal(journey.mode, "live");
  assert.equal(journey.doors.length, 3);
  assert.deepEqual(journey.doors.map(door => door.tier), ["Familiar", "Adjacent", "Unexpected"]);
  assert.equal(calls.searches.length, 3);
  assert.equal(calls.insights.length, 3);
  assert.ok(calls.insights.every(call => call.entityIds.length === 3));
  assert.ok(calls.insights.some(call => call.location === "Brooklyn, New York"));
  assert.ok(journey.doors.every(door => door.entityId.startsWith("candidate-")));
  assert.ok(journey.doors.every(door => door.discoveryDistance.isQlooScore === false));
  assert.ok(journey.doors.every(door => door.whyNow.includes(door.title) && !door.whyNow.includes("You specified")));
  assert.ok(journey.doors.every(door => door.evidence.includes("Check opening hours")));
  assert.equal(journey.methodology.llmUsed, false);
  assert.ok(journey.graph.nodes.some(node => node.provenance === "USER"));
  assert.ok(journey.graph.nodes.some(node => node.provenance === "QLOO"));
  assert.ok(journey.graph.edges.some(edge => edge.type === "qloo-insights-result"));
  assert.ok(events.some(event => event.id === "entity-resolution" && event.status === "complete"));
  assert.ok(events.some(event => event.id === "qloo-exploration" && event.status === "complete"));
  assert.equal(journey.tools.filter(tool => tool.endpoint === "GET /v2/insights/").length, 3);
});

test("selected depth changes the routed Qloo output types", async () => {
  const { qloo, calls } = fakeQloo();
  await runDiscovery({ ...request, depth: "Take me somewhere unexpected" }, { qloo });

  assert.deepEqual(calls.insights.map(call => call.entityType), ["movie", "place", "destination"]);
});

test("explicit feedback changes the next Qloo route", async () => {
  const { qloo, calls } = fakeQloo();
  const journey = await runDiscovery({ ...request, depth: "Close to home", feedback: ["Too familiar"] }, { qloo });

  assert.deepEqual(calls.insights.map(call => call.entityType), ["movie", "artist", "podcast"]);
  assert.deepEqual(journey.feedbackApplied, ["Too familiar"]);
  assert.ok(journey.notices.some(notice => notice.includes("changed the next Qloo route")));
});

test("each compass intention changes Qloo routing without replacing the user's anchors", async () => {
  const plans = [];
  for (const intent of ["Find my people", "Go deeper", "Try something new"]) {
    const { qloo, calls } = fakeQloo();
    const journey = await runDiscovery({ ...request, intent }, { qloo });
    plans.push(calls.insights.map(call => call.entityType).join(","));
    assert.equal(journey.intent, intent);
    assert.deepEqual(journey.anchors, request.anchors.map(anchor => anchor.label));
    assert.ok(calls.insights.every(call => call.entityIds.length === request.anchors.length));
  }
  assert.equal(new Set(plans).size, 3);
});

test("opening a live door reuses its Qloo entity ID instead of re-searching the title", async () => {
  const { qloo, calls } = fakeQloo();
  const journey = await runDiscovery({
    ...request,
    anchors: [{ label: "A selected movie", category: "Film" }],
    resolvedEntities: [{
      label: "A selected movie",
      category: "Film",
      entityId: "previous-qloo-entity-id",
      entityType: "movie",
    }],
    excludedEntityIds: ["candidate-movie"],
  }, { qloo });

  assert.equal(calls.searches.length, 0);
  assert.ok(calls.insights.every(call => call.entityIds.includes("previous-qloo-entity-id")));
  assert.deepEqual(journey.methodology.qlooEndpoints, ["/v2/insights/"]);
  assert.equal(journey.resolvedAnchors[0].reusedSeedEntity, true);
  assert.ok(journey.graph.edges.some(edge => edge.type === "user-selected-qloo-entity" && edge.provenance === "USER"));
});

test("price and timing feedback avoid venue-like result types without asserting prices or schedules", async () => {
  const { qloo, calls } = fakeQloo();
  const journey = await runDiscovery({ ...request, feedback: ["Too expensive", "Wrong time"] }, { qloo });

  assert.ok(calls.insights.every(call => !["place", "destination"].includes(call.entityType)));
  assert.ok(journey.notices.some(notice => notice.includes("no price or schedule data is inferred")));
});

test("unresolved user interests fail explicitly instead of switching to sample data", async () => {
  const { qloo } = fakeQloo({ unresolved: true });
  await assert.rejects(
    runDiscovery(request, { qloo }),
    error => error instanceof AgentRequestError && error.code === "UNRESOLVED_ANCHORS",
  );
});

test("discovery input rejects more than the policy limit of anchors", () => {
  assert.throws(
    () => validateDiscoveryRequest({
      ...request,
      anchors: Array.from({ length: 6 }, (_, index) => ({ label: `Interest ${index}`, category: "Music" })),
    }),
    error => error instanceof AgentRequestError && error.code === "TOO_MANY_ANCHORS",
  );
});

test("Qloo explainability is bounded and strips credential-like keys", async () => {
  const { qloo } = fakeQloo();
  qloo.getInsights = async (entityType, entityIds) => ({
    entities: [{
      entity_id: `safe-${entityType}`,
      name: `Safe ${entityType} result`,
      query: {
        explainability: {
          matched_entities: entityIds,
          apiKey: "must-not-reach-browser",
          nested: { token: "secret", label: "visible" },
          large: "x".repeat(2_000),
        },
      },
    }],
  });

  const journey = await runDiscovery({ ...request, anchors: request.anchors.slice(0, 1) }, { qloo });
  const explanation = journey.doors[0].explainability;
  assert.equal("apiKey" in explanation, false);
  assert.equal("token" in explanation.nested, false);
  assert.equal(explanation.nested.label, "visible");
  assert.ok(explanation.large.length <= 500);
});

test("partial Qloo results remain partial and never acquire fabricated doors", async () => {
  const { qloo } = fakeQloo({ emptyInsightTypes: ["artist"] });
  const journey = await runDiscovery(request, { qloo });

  assert.equal(journey.doors.length, 2);
  assert.ok(journey.notices.some(notice => notice.includes("returned 2 of 3")));
  assert.ok(journey.doors.every(door => door.id.startsWith("qloo-")));
});

test("zero Qloo insight candidates do not fall back to the demo path", async () => {
  const qloo = {
    async searchEntities(query, entityType) {
      return [{ entity_id: `source-${entityType}-${query}`, name: query }];
    },
    async getInsights() {
      return { entities: [] };
    },
  };
  await assert.rejects(
    runDiscovery(request, { qloo }),
    error => error instanceof AgentRequestError && error.code === "NO_CANDIDATES",
  );
});
