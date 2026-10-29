import { test, expect, type Page } from "@playwright/test";
import type { DiscoveryRequest, LiveJourney } from "../agentApi";

function journey(input: DiscoveryRequest, id = "alternative", empty = false): LiveJourney {
  return {
    ...input, mode: "live", city: input.location, iteration: input.iteration || 0,
    anchors: input.anchors.map(anchor => anchor.label), categories: Object.fromEntries(input.anchors.map(anchor => [anchor.label, anchor.category])),
    feedbackApplied: [], resolvedAnchors: input.anchors.map((anchor, index) => ({ ...anchor, entityId: `seed-${index}`, entityType: "artist", entityName: anchor.label, exactNameMatch: true, reusedSeedEntity: false })),
    graph: { nodes: [], edges: [] }, tools: [], notices: [], generatedAt: "2026-10-29T12:00:00Z",
    methodology: { agent: "fixture", llmUsed: false, qlooBase: "", qlooEndpoints: [], discoveryDistance: "ordinal", candidateOrder: "returned" },
    doors: empty ? [] : [{
      id: `qloo-${id}`, entityId: id, entityType: "artist", title: id === "original" ? "Original artist" : `Returned ${input.location} ${input.depth}`,
      tier: "Adjacent", category: "Music", kind: "Artist", source: input.anchors[0]?.label || "", sourceEntityIds: ["seed-0"],
      why: "Returned by the controlled browser fixture.", whyYou: "", whyNow: "Try a short preview.", now: "Try a short preview.",
      thread: "A returned cultural direction", evidence: "Test fixture, not real external Qloo output.", description: "", imageUrl: "", tags: [], popularity: null, explainability: null, coordinates: null,
      discoveryDistance: { tier: "Adjacent", ordinal: 2, rationale: "Application route label.", isQlooScore: false },
      queryContext: { intent: input.intent, depth: input.depth, location: input.location, context: input.context },
    }],
  };
}
const originalRequest: DiscoveryRequest = {
  location: "Brooklyn", occasion: "Saturday", intent: "Try something new", depth: "A little further",
  context: { time: "Saturday", budget: "Flexible", movement: "Open to anything", conditions: "Open to anything" },
  anchors: [{ label: "Nina Simone", category: "Music" }], iteration: 0,
};
async function setup(page: Page, withOriginal = true, limit = 5) {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: true, agent: "fixture",
    demoAvailable: true, policy: { limits: { anchorsPerRequest: limit } },
  } }));
  if (withOriginal) {
    const original = journey(originalRequest, "original");
    await page.addInitScript(original => {
      localStorage.setItem("opendoor.journey", JSON.stringify(original));
      localStorage.setItem("opendoor.saved", JSON.stringify([{ ...original.doors[0], city: original.city, mode: "live", anchors: original.anchors, savedAt: "Earlier" }]));
    }, original);
  }
  await page.goto("/?view=what-if");
  await expect(page.getByRole("heading", { name: "What If? Explorer", exact: true })).toBeVisible();
}
const capture = async (page: Page) => page.getByRole("button", { name: "Use this starting point", exact: true }).click();
const submit = async (page: Page) => page.getByRole("button", { name: "Explore this what-if", exact: true }).click();

test("current journey snapshots, private interpretation preview, manual overrides, repeated scenarios and exact restore", async ({ page }) => {
  const requests: DiscoveryRequest[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as DiscoveryRequest; requests.push(input);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(input, `alternative-${requests.length}`) }) + "\n" });
  });
  await setup(page);
  const storedOriginal = await page.evaluate(() => localStorage.getItem("opendoor.journey"));
  await capture(page);
  await page.getByLabel("Your private what-if scenario").fill("What if I only have two hours? I am exploring in Paris. I want something completely different. Private note about my family.");
  await expect(page.getByLabel(/^Alternative city/)).toHaveValue("Brooklyn");
  await page.getByRole("button", { name: "Apply recognized changes", exact: true }).click();
  await expect(page.getByLabel(/^Alternative time/)).toHaveValue("2 hours");
  await expect(page.getByLabel(/^Alternative city/)).toHaveValue("Paris");
  await page.getByLabel(/^Alternative city/).fill("Lisbon");
  await submit(page);
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await expect(alternatives).toContainText("Returned Lisbon Take me somewhere unexpected");
  expect(requests[0].location).toBe("Lisbon");
  expect(requests[0].depth).toBe("Take me somewhere unexpected");
  expect(requests[0].context.time).toBe("2 hours");
  expect(JSON.stringify(requests[0])).not.toContain("Private note");
  expect(JSON.stringify(requests[0])).not.toContain("What if");
  expect(await page.evaluate(() => localStorage.getItem("opendoor.journey"))).toBe(storedOriginal);
  await expect(page.getByRole("complementary", { name: "Original starting point" })).toContainText("Original artist");
  await expect(alternatives).toContainText("1 newly returned");
  await page.getByLabel(/^Alternative depth/).selectOption("Close to home");
  await page.getByLabel(/^Alternative budget/).fill("Lower cost");
  await submit(page);
  await expect(alternatives).toContainText("Returned Lisbon Close to home");
  expect(requests).toHaveLength(2);
  expect(requests[1].anchors).toEqual(requests[0].anchors);
  expect(requests[1].iteration).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.journey"))).toBe(storedOriginal);
  await page.getByRole("button", { name: "Restore original scenario", exact: true }).click();
  await expect(page.getByLabel(/^Alternative city/)).toHaveValue("Brooklyn");
  await expect(page.getByLabel(/^Alternative time/)).toHaveValue("Saturday");
  await expect(page.getByLabel("Your private what-if scenario")).toHaveValue("");
  await expect(alternatives.locator(".door-card")).toHaveCount(0);
});

test("saved-item start reuses entity seed, selected personal connection, live saves and existing exploration callbacks", async ({ page }) => {
  const requests: DiscoveryRequest[] = [];
  const sources: string[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as DiscoveryRequest; requests.push(input); sources.push(route.request().headers()["x-qloo-connection"]);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(input) }) + "\n" });
  });
  await setup(page);
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await page.getByLabel("Start from", { exact: true }).selectOption("saved:qloo-original");
  await capture(page);
  await page.getByLabel(/^Alternative city/).fill("Paris");
  await submit(page);
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await expect(alternatives).toContainText("personal connection");
  expect(requests[0].resolvedEntities).toEqual([{ label: "Original artist", category: "Music", entityId: "original", entityType: "artist" }]);
  expect(sources[0]).toBe("personal");
  const card = alternatives.locator(".door-card");
  await card.getByRole("button", { name: "Save Returned Paris A little further", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.saved") || "[]"));
  expect(saved[0].mode).toBe("live"); expect(saved[0].entityId).toBe("alternative");
  await card.locator(".door-preview").click();
  await card.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].resolvedEntities?.[0].entityId).toBe("alternative");
  await expect(page.locator("#journey-result")).toBeVisible();
});

test("new interests: mobile, honest local-only changes, privacy, validation and matching mascot scale", async ({ page }) => {
  const requests: DiscoveryRequest[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as DiscoveryRequest; requests.push(input);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(input) }) + "\n" });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, false);
  await capture(page); await submit(page);
  await expect(page.getByRole("alert")).toContainText("at least one named interest");
  expect(requests).toHaveLength(0);
  await page.getByLabel("Named interest 1", { exact: true }).fill("Spirited Away");
  await page.getByLabel("Interest category 1", { exact: true }).selectOption("Film");
  await capture(page);
  await page.getByLabel("Your private what-if scenario").fill("I have a smaller budget. I am traveling with children. Private needs stay here.");
  await page.getByRole("button", { name: "Apply recognized changes", exact: true }).click();
  await submit(page);
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await expect(alternatives).toContainText("Only planning context changed");
  await expect(alternatives).toContainText("No comparable original live entity set");
  expect(requests[0].anchors).toEqual([{ label: "Spirited Away", category: "Film" }]);
  expect(requests[0].context.budget).toBe("Lower cost");
  expect(JSON.stringify(requests[0])).not.toContain("children");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Private needs");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Restore original scenario", exact: true }).click();
  const introWidth = await page.locator(".what-if-explorer .bridge-intro .mascot-visual").evaluate(element => element.getBoundingClientRect().width);
  const emptyWidth = await alternatives.locator(".bridge-state .mascot-visual").evaluate(element => element.getBoundingClientRect().width);
  expect(Math.abs(introWidth - emptyWidth)).toBeLessThan(1);
});

test("failure/retry, no results and cancellation retain originals and reject late responses", async ({ page }) => {
  let mode = "error";
  await page.route("**/api/agent/discover", async route => {
    if (mode === "error") return route.fulfill({ status: 503, json: { message: "Fixture scenario unavailable." } });
    if (mode === "slow") await new Promise(resolve => setTimeout(resolve, 1600));
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(route.request().postDataJSON(), "alternative", mode !== "slow") }) + "\n" }).catch(() => {});
  });
  await setup(page); await capture(page); await submit(page);
  await expect(page.getByRole("alert")).toContainText("Fixture scenario unavailable");
  mode = "empty";
  await page.getByRole("button", { name: "Retry what-if discovery", exact: true }).click();
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await expect(alternatives).toContainText("No alternatives returned");
  await expect(page.getByRole("complementary", { name: "Original starting point" })).toContainText("Original artist");
  mode = "slow"; await submit(page);
  await expect(page.getByLabel("Your private what-if scenario")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel what-if discovery", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await page.waitForTimeout(1700);
  await expect(alternatives.locator(".door-card")).toHaveCount(0);
});

test("discovery-result start and explicit return restore the original after exploring an alternative", async ({ page }) => {
  await page.route("**/api/agent/discover", route => route.fulfill({
    contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(route.request().postDataJSON()) }) + "\n",
  }));
  await setup(page);
  await page.getByLabel("Start from", { exact: true }).selectOption("result:qloo-original");
  await capture(page); await submit(page);
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await alternatives.locator(".door-card .door-preview").click();
  await alternatives.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect(page.locator("#journey-result")).toBeVisible();
  await page.getByRole("navigation", { name: "Discovery experiences" }).getByRole("button", { name: "What If? Explorer", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Original starting point" })).toContainText("Original artist");
  await page.getByRole("button", { name: "Return to original discovery", exact: true }).click();
  await expect(page.locator("#journey-result .door-card h3")).toHaveText("Original artist");
});

test("planning-only revisions can retain identical Qloo entities without claiming a new match or suitability", async ({ page }) => {
  const requests: DiscoveryRequest[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as DiscoveryRequest; requests.push(input);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(input, "original") }) + "\n" });
  });
  await setup(page); await capture(page);
  await page.getByLabel(/^Alternative time/).fill("2 hours");
  await page.getByLabel(/^Alternative budget/).fill("Lower cost");
  await page.getByLabel(/^Alternative movement/).fill("Mostly seated");
  await submit(page);
  const alternatives = page.getByRole("region", { name: "What-if alternatives" });
  await expect(alternatives).toContainText("0 newly returned · 1 retained · 0 original results not returned");
  await expect(alternatives).toContainText("Only planning context changed");
  await alternatives.getByText("Local practical planning—not Qloo evidence", { exact: true }).click();
  await expect(alternatives).toContainText("These results are not price-filtered");
  await expect(alternatives).toContainText("No duration has been verified");
  await expect(alternatives).toContainText("Mobility suitability is not verified");
  expect(requests[0].intent).toBe(originalRequest.intent);
  expect(requests[0].depth).toBe(originalRequest.depth);
  expect(requests[0].location).toBe(originalRequest.location);
});
