import assert from "node:assert/strict";
import test from "node:test";
import { createQlooClient, QLOO_BASE_URL } from "./qloo.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("Qloo Search uses the documented hackathon host, route, query, and entity type", async () => {
  let captured;
  const client = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async (url, options) => {
      captured = { url: new URL(url), options };
      return jsonResponse({ results: { entities: [{ entity_id: "entity-1", name: "Live Jazz" }] } });
    },
  });

  const entities = await client.searchEntities("live jazz", "artist");

  assert.equal(captured.url.origin, QLOO_BASE_URL);
  assert.equal(captured.url.pathname, "/search");
  assert.equal(captured.url.searchParams.get("query"), "live jazz");
  assert.equal(captured.url.searchParams.get("types"), "urn:entity:artist");
  assert.equal(captured.url.searchParams.get("take"), "5");
  assert.equal(captured.url.searchParams.get("sort_by"), "match");
  assert.equal(captured.options.headers["X-Api-Key"], "unit-test-key");
  assert.equal(entities[0].entity_id, "entity-1");
});

test("Qloo Insights sends each resolved entity and explainability, and only applies location to supported types", async () => {
  const requests = [];
  const client = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
      return jsonResponse({ results: { entities: [] }, query: { explainability: [] } });
    },
  });

  await client.getInsights("place", ["entity-a", "entity-b"], "Brooklyn, New York");
  await client.getInsights("movie", ["entity-a"], "Brooklyn, New York");

  const place = requests[0].url;
  assert.equal(place.pathname, "/v2/insights/");
  assert.equal(place.searchParams.get("filter.type"), "urn:entity:place");
  assert.deepEqual(place.searchParams.getAll("signal.interests.entities"), ["entity-a", "entity-b"]);
  assert.equal(place.searchParams.get("feature.explainability"), "true");
  assert.equal(place.searchParams.get("signal.location.query"), "Brooklyn, New York");

  const movie = requests[1].url;
  assert.equal(movie.searchParams.get("filter.type"), "urn:entity:movie");
  assert.equal(movie.searchParams.get("signal.location.query"), null);
});

test("Qloo authentication errors are safe and do not include response bodies", async () => {
  const client = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "sensitive upstream detail" }),
    }),
  });

  await assert.rejects(
    client.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_AUTH_ERROR" && !error.message.includes("sensitive upstream detail"),
  );
});

test("Qloo response body size is bounded before parsing a streamed response", async () => {
  const oversized = new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const client = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => oversized,
  });

  await assert.rejects(
    client.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_RESPONSE_TOO_LARGE",
  );
});

test("network failures do not expose upstream exception details", async () => {
  const client = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => { throw new Error("private connection details"); },
  });
  await assert.rejects(client.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_NETWORK_ERROR" && !error.message.includes("private"));
});

test("timeouts and rate limits have explicit recovery errors", async () => {
  const timedOut = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => { throw new DOMException("upstream detail", "TimeoutError"); },
  });
  await assert.rejects(timedOut.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_TIMEOUT");
  const limited = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => jsonResponse({}, 429),
  });
  await assert.rejects(limited.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_RATE_LIMIT" && error.status === 429);
});

test("invalid JSON fails explicitly and missing entities remain empty", async () => {
  const invalid = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  });
  await assert.rejects(invalid.searchEntities("jazz", "artist"),
    error => error.code === "QLOO_INVALID_RESPONSE");
  const empty = createQlooClient({
    apiKey: "unit-test-key",
    fetchImpl: async () => jsonResponse({ results: { entities: "not-an-array" } }),
  });
  assert.deepEqual(await empty.searchEntities("jazz", "artist"), []);
});
