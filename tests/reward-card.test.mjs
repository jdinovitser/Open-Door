import test from "node:test";
import assert from "node:assert/strict";
import { progressRewards, earnedLevel, STAR_MILESTONES } from "../src/rewards/model.ts";
import { renderRewardCardSvg } from "../src/rewards/cardArtwork.ts";

test("zero rewards exports no medals, trophies, stars, or unearned placeholders", () => {
  const { card } = progressRewards({ doorsOpened: 0, braveDoorsOpened: 0, categories: [] }, 0);
  assert.deepEqual(card, { medals: [], trophy: null, stars: 0 });
  const svg = renderRewardCardSvg(card, "");
  assert.doesNotMatch(svg, /Bronze medal|Silver medal|Gold medal| trophy<|[1-5] stars?</);
  assert.match(svg, /Personal progress \/ Just for fun/);
});

test("partial rewards use existing levels and export only an explicit reward allowlist", () => {
  const summary = {
    doorsOpened: 6, braveDoorsOpened: 3, categories: ["private-interest"],
    email: "private@example.test", accountId: "user_private", location: "Brooklyn",
    savedDoors: ["private-door"], interests: ["experimental jazz"],
  };
  const { card, medalPoints, trophyLevel } = progressRewards(summary, 0);
  assert.deepEqual(card, { medals: [{ name: "Brave", level: "silver" }, { name: "Explorer", level: "bronze" }], trophy: "bronze", stars: 3 });
  assert.equal(medalPoints, 3);
  assert.equal(trophyLevel, "bronze");
  // Additional fields cannot leak even if passed accidentally to the renderer.
  const svg = renderRewardCardSvg({ ...summary, ...card }, "");
  assert.match(svg, /Silver medal/);
  assert.match(svg, /Bronze trophy/);
  assert.match(svg, /3 stars/);
  assert.doesNotMatch(svg, /Gold medal|Door Collector|private|Brooklyn|experimental jazz|@/);
});

test("all medals, trophy, and five stars are earned at full progress", () => {
  const { card } = progressRewards({ doorsOpened: 15, braveDoorsOpened: 5, categories: ["a", "b", "c", "d", "e"] }, 10);
  assert.equal(card.medals.length, 3);
  assert.ok(card.medals.every(medal => medal.level === "gold"));
  assert.equal(card.trophy, "gold");
  assert.equal(card.stars, 5);
  const svg = renderRewardCardSvg(card, "");
  assert.equal((svg.match(/Gold medal/g) || []).length, 3);
  assert.match(svg, /Gold trophy/);
  assert.match(svg, /5 stars/);
  assert.doesNotMatch(svg, /Bronze medal|Silver medal/);
});

test("every existing track, trophy, and star boundary stays consistent", () => {
  for (const milestones of [[1, 3, 5], [1, 5, 10]]) {
    assert.equal(earnedLevel(0, milestones), "none");
    for (const [index, level] of ["bronze", "silver", "gold"].entries()) {
      assert.equal(earnedLevel(milestones[index], milestones), level);
      assert.equal(earnedLevel(milestones[index] - 1, milestones), ["none", "bronze", "silver"][index]);
    }
  }
  for (const [index, threshold] of STAR_MILESTONES.entries()) {
    assert.equal(progressRewards({ doorsOpened: threshold, braveDoorsOpened: 0, categories: [] }, 0).card.stars, index + 1);
    assert.equal(progressRewards({ doorsOpened: threshold - 1, braveDoorsOpened: 0, categories: [] }, 0).card.stars, index);
  }
  for (const [saved, brave, categoryCount, expected] of [
    [0, 1, 1, null], [1, 1, 1, "bronze"], [1, 3, 3, "bronze"],
    [5, 3, 3, "silver"], [5, 5, 5, "silver"], [10, 5, 5, "gold"],
  ]) {
    assert.equal(progressRewards({ doorsOpened: 15, braveDoorsOpened: brave, categories: Array(categoryCount).fill("x") }, saved).card.trophy, expected);
  }
});
