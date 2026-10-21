import test from "node:test";
import assert from "node:assert/strict";
import { normalizePreferences } from "./accountPreferences.js";

const valid = { intent: "Try something new", depth: "Surprise me", budget: "Free or low-cost", movement: "Easy walking" };

test("account preference memory accepts only the four explicitly consented structured choices", () => {
  assert.deepEqual(normalizePreferences(valid), valid);
  for (const value of [null, [], {}, { ...valid, movement: "unverified accessible" },
    { ...valid, scenario: "private health note" }, { ...valid, userId: "someone-else" },
    { ...valid, budget: "<script>alert(1)</script>" }]) {
    assert.equal(normalizePreferences(value), null);
  }
});
