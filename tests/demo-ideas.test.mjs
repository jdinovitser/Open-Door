import test from "node:test";
import assert from "node:assert/strict";
import { demoIdeas } from "../src/demoIdeas.ts";

const interests = [{ label: "jazz", category: "Music" }, { label: "painting", category: "Art" }];
test("demo continuations keep the original interests and exhaust their examples without recycling titles", () => {
  const seenTitles = [];
  let focusCategory;
  for (let iteration = 0; iteration < 12; iteration++) {
    const ideas = demoIdeas(interests, "", "Surprise me", [], iteration, { seenTitles, focusCategory });
    if (!ideas.length) { assert.equal(seenTitles.length, 27); return; }
    assert.equal(new Set(ideas.map(idea => idea.category)).size, ideas.length);
    for (const idea of ideas) {
      assert.ok(!seenTitles.includes(idea.title));
      assert.ok(idea.why.includes("jazz and painting"));
      assert.ok(idea.now.length > 70);
      assert.doesNotMatch(`${idea.title} ${idea.why} ${idea.now}`, /step \d|authored|cultural direction|thread|retrieved|modest step/i);
      seenTitles.push(idea.title);
    }
    focusCategory = ideas[0].category;
  }
  assert.fail("Examples should have an explicit end rather than recycling activities.");
});
test("explicit music and art interests in a scenario shape the example ideas", () => {
  const ideas = demoIdeas([{ label: "cinema", category: "Film" }], "I love music and art", "A little further", [], 0);
  assert.deepEqual(ideas.slice(0, 2).map(idea => idea.category), ["Music", "Art"]);
  assert.ok(ideas.every(idea => idea.source === "music and art"));
});
test("a diagnosis or an age does not invent a taste preference", () => {
  const standard = demoIdeas(interests, "", "A little further", [], 0);
  const personal = demoIdeas(interests, "I am 70 and have a health condition", "A little further", [], 0);
  assert.deepEqual(personal, standard);
});
test("close-to-home examples and selected feedback have concrete effects", () => {
  const close = demoIdeas([{ label: "jazz", category: "Music" }], "", "Close to home", ["Too expensive", "Wrong time"], 0, { intent: "Find my people" });
  assert.equal(close.length, 3);
  assert.ok(close.every(idea => idea.category === "Music" && idea.now.includes("for free") && idea.now.includes("five minutes") && idea.now.includes("invite a friend")));
});
