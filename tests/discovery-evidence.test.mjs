import test from "node:test";
import assert from "node:assert/strict";
import { connectionSummary, destinationActions } from "../src/discoveryEvidence.ts";

const door = { title: "Returned place", source: "Nina Simone", category: "Experiences", entityId: "place-1", entityType: "place", coordinates: { latitude: 40.7, longitude: -73.9 }, websiteUrl: "https://example.org/visit" };
test("physical results use actual returned coordinates and supplied HTTPS websites", () => {
  assert.deepEqual(destinationActions(door, "live"), { map: "https://www.google.com/maps/search/?api=1&query=40.7,-73.9", website: "https://example.org/visit" });
});
test("missing/invalid coordinates, cultural entities, and prepared examples cannot masquerade as destinations", () => {
  for (const patch of [{ coordinates: null }, { coordinates: { latitude: null, longitude: null } }, { coordinates: { latitude: 91, longitude: 0 } }, { entityType: "artist" }]) {
    assert.equal(destinationActions({ ...door, ...patch }, "live").map, "");
  }
  for (const websiteUrl of ["javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "invalid"]) {
    assert.equal(destinationActions({ ...door, websiteUrl }, "live").website, "");
  }
  assert.deepEqual(destinationActions(door, "demo"), { map: "", website: "" });
});
test("explanations state retrieval evidence without inventing a relationship", () => {
  assert.match(connectionSummary(door, "live"), /Qloo Insights returned.*Nina Simone/);
  assert.match(connectionSummary(door, "live"), /more specific reason is not established/);
  assert.match(connectionSummary({ ...door, entityId: undefined }, "live"), /limited source information/);
  assert.match(connectionSummary(door, "demo"), /not a Qloo recommendation/);
});
