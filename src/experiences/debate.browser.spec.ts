import { test, expect, type Page } from "@playwright/test";
import type { DiscoveryRequest, LiveJourney } from "../agentApi";

const originalRequest: DiscoveryRequest = {
  location: "Brooklyn", occasion: "Saturday", intent: "Try something new", depth: "A little further",
  context: { time: "Saturday", budget: "Flexible", movement: "Mostly seated", conditions: "Open to anything" },
  anchors: [{ label: "Nina Simone", category: "Music" }], iteration: 0,
};
function journey(input: DiscoveryRequest, ids = ["original"]): LiveJourney {
  const resolved = input.anchors.map((anchor, index) => ({
    ...anchor, entityId: input.resolvedEntities?.find(entity => entity.label === anchor.label)?.entityId || `seed-${index}`,
    entityType: "artist", entityName: anchor.label, exactNameMatch: true, reusedSeedEntity: !!input.resolvedEntities?.length,
  }));
  return {
    ...input, mode: "live", city: input.location, iteration: input.iteration || 0,
    anchors: input.anchors.map(anchor => anchor.label), categories: Object.fromEntries(input.anchors.map(anchor => [anchor.label, anchor.category])),
    feedbackApplied: input.feedback || [], resolvedAnchors: resolved, graph: { nodes: [], edges: [] }, tools: [], notices: [],
    generatedAt: "2026-10-29T12:00:00Z",
    methodology: { agent: "fixture", llmUsed: false, qlooBase: "", qlooEndpoints: [], discoveryDistance: "ordinal", candidateOrder: "returned" },
    doors: ids.map(id => ({
      id: `qloo-${id}`, entityId: id, entityType: "artist", title: `Artist ${id}`, tier: "Adjacent", category: "Music", kind: "Artist",
      source: input.anchors.map(anchor => anchor.label).join(", "), sourceEntityIds: resolved.map(anchor => anchor.entityId),
      why: "Returned by a controlled test fixture.", whyYou: "", whyNow: "Try a preview.", now: "Try a preview.",
      evidence: "Fixture query-conditioned result, not external Qloo output.", thread: "A returned direction", description: "", imageUrl: "", tags: [],
      popularity: null, coordinates: null, explainability: { relationship: "query-conditioned", source_entity_ids: resolved.map(anchor => anchor.entityId), secret: "DO-NOT-RENDER" },
      discoveryDistance: { tier: "Adjacent", ordinal: 2, rationale: "Application routing.", isQlooScore: false },
      queryContext: { intent: input.intent, depth: input.depth, location: input.location, context: input.context },
    })),
  };
}
async function setup(page: Page, options: { original?: boolean; configured?: boolean; demo?: boolean } = {}) {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: options.configured !== false, sharedQlooConfigured: options.configured !== false,
    personalQlooConnected: options.configured !== false, agent: "fixture", demoAvailable: true, policy: { limits: { anchorsPerRequest: 5 } },
  } }));
  if (options.original !== false) {
    const original = journey(originalRequest);
    await page.addInitScript(({ original, demo }) => {
      const stored = { ...original, mode: demo ? "demo" : "live" };
      localStorage.setItem("opendoor.journey", JSON.stringify(stored));
      localStorage.setItem("opendoor.saved", JSON.stringify([{ ...stored.doors[0], city: stored.city, mode: stored.mode, anchors: stored.anchors, savedAt: "Earlier", explainability: null }]));
    }, { original, demo: !!options.demo });
  }
  await page.goto("/?view=debate");
  await expect(page.getByRole("heading", { name: "Discovery Debate", exact: true })).toBeVisible();
}
const start = async (page: Page) => page.getByRole("button", { name: "Start this debate", exact: true }).click();
async function challenge(page: Page, label: string) {
  await page.locator(".debate-quick-actions").getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
}
const current = (page: Page) => page.getByRole("complementary", { name: "Currently debated recommendation" });
const transcript = (page: Page) => page.getByRole("list", { name: "Session transcript" });

test("all evidence challenge types are contextual follow-ups; ambiguous private prose requires an explicit action", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/agent/discover", route => { calls++; return route.abort(); });
  await setup(page); await start(page);
  const originalStorage = await page.evaluate(() => localStorage.getItem("opendoor.journey"));
  for (const label of ["Why this recommendation?", "Connect it to my interests", "Show the evidence", "Challenge the case for it", "Question a weak connection", "A different perspective"]) await challenge(page, label);
  await expect(transcript(page)).toContainText("Nina Simone → Nina Simone [seed-0]");
  await expect(transcript(page)).toContainText("not pairwise proof");
  await expect(transcript(page)).toContainText("cannot honestly convince");
  await expect(transcript(page)).toContainText("not additional Qloo evidence");
  await page.getByLabel("Your private challenge").fill("What evidence supports that?");
  await expect(page.locator(".debate-routing-preview")).toContainText("Recognized by an exact wording rule");
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
  await expect(transcript(page).locator("li").last()).toContainText("follow-up");
  await transcript(page).getByText("Evidence excerpt at this turn", { exact: true }).last().click();
  await expect(transcript(page).locator("pre").last()).toContainText("query-conditioned");
  await expect(transcript(page).locator("pre").last()).not.toContainText("DO-NOT-RENDER");
  await page.getByLabel("Your private challenge").fill("Private medical and family details");
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not recognized");
  await page.getByLabel("Challenge action", { exact: true }).selectOption("persuade");
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
  await expect(transcript(page)).toContainText("Private medical and family details");
  expect(calls).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.journey"))).toBe(originalStorage);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Private medical");
});

test("disagreement and unexpected requests use selected entity IDs, feedback and no-repeat history; evidence provenance survives connection changes", async ({ page }) => {
  const requests: DiscoveryRequest[] = []; const sources: string[] = [];
  await page.route("**/api/agent/discover", route => {
    const request = route.request().postDataJSON() as DiscoveryRequest; requests.push(request); sources.push(route.request().headers()["x-qloo-connection"]);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(request, requests.length === 1 ? ["a", "b"] : ["a", "c"]) }) + "\n" });
  });
  await setup(page);
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await start(page);
  await expect(current(page)).toContainText("Not recorded in the source snapshot");
  await challenge(page, "I disagree—find another");
  await expect(current(page).getByRole("heading", { name: "Artist a", exact: true })).toBeVisible();
  expect(requests[0].feedback).toEqual(["Not my scene"]);
  expect(requests[0].resolvedEntities?.[0].entityId).toBe("original");
  expect(requests[0].excludedEntityIds).toContain("original");
  expect(requests[0].context).toEqual(originalRequest.context);
  expect(sources[0]).toBe("personal");
  await page.getByRole("button", { name: "Debate Artist b", exact: true }).click();
  await challenge(page, "Show the evidence");
  await expect(transcript(page).locator("li").last()).toContainText("Artist b");
  await expect(transcript(page).locator("li").last()).toContainText("Artist original → Artist original [original]");
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await expect(current(page)).toContainText("personal connection");
  await challenge(page, "Retrieve something more unexpected");
  await expect(current(page).getByRole("heading", { name: "Artist c", exact: true })).toBeVisible();
  expect(requests[1].resolvedEntities?.[0].entityId).toBe("b");
  expect(requests[1].excludedEntityIds).toEqual(expect.arrayContaining(["original", "a", "b"]));
  expect(requests[1].feedback).toEqual(["Not my scene", "Too familiar"]);
  expect(requests[1].depth).toBe("Take me somewhere unexpected");
  expect(requests[1].intent).toBe("Try something new");
  expect(sources[1]).toBe("shared");
  await expect(page.getByRole("region", { name: "Debate returned recommendations" }).locator(".door-card h3")).toHaveText("Artist c");
  await challenge(page, "Why this recommendation?");
  await expect(transcript(page).locator("li").last()).toContainText("Artist c");
  await expect(transcript(page)).toContainText("Artist original");
});

test("new named interests generate an actual request; selected result saves and explores through App callbacks", async ({ page }) => {
  const requests: DiscoveryRequest[] = [];
  await page.route("**/api/agent/discover", route => {
    const request = route.request().postDataJSON() as DiscoveryRequest; requests.push(request);
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(request, ["generated"]) }) + "\n" });
  });
  await setup(page, { original: false });
  await page.getByRole("button", { name: "Generate a recommendation", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at least one named interest");
  expect(requests).toHaveLength(0);
  await page.getByLabel("Debate interest 1", { exact: true }).fill("Nina Simone");
  await page.getByLabel("Debate category 1", { exact: true }).selectOption("Music");
  await page.getByRole("button", { name: "Add debate interest", exact: true }).click();
  await page.getByLabel("Debate interest 2", { exact: true }).fill("Spirited Away");
  await page.getByLabel("Debate category 2", { exact: true }).selectOption("Film");
  await page.getByRole("button", { name: "Generate a recommendation", exact: true }).click();
  await expect(current(page)).toContainText("Artist generated");
  expect(requests[0].anchors).toEqual([{ label: "Nina Simone", category: "Music" }, { label: "Spirited Away", category: "Film" }]);
  await page.getByRole("button", { name: "Save selected recommendation", exact: true }).click();
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.saved") || "[]"));
  expect(saves[0].mode).toBe("live"); expect(saves[0].entityId).toBe("generated");
  await page.getByRole("button", { name: "Explore selected in Open Door", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].resolvedEntities?.[0].entityId).toBe("generated");
  await expect(page.locator("#journey-result")).toBeVisible();
  await page.getByRole("navigation", { name: "Discovery experiences" }).getByRole("button", { name: "Discovery Debate", exact: true }).click();
  await expect(current(page)).toContainText("Artist generated");
  await expect(transcript(page)).toContainText("starts a new conversation");
});

test("saved provenance and missing evidence remain explicit; dismissing clear preserves the conversation", async ({ page }) => {
  await setup(page);
  await page.getByLabel("Recommendation source", { exact: true }).selectOption("saved:qloo-original");
  await start(page); await challenge(page, "Show the evidence");
  await expect(current(page)).toContainText("does not retain its full historical query");
  await expect(transcript(page)).toContainText("No resolved input can be attributed");
  await expect(transcript(page)).toContainText("No structured Qloo explainability");
  await page.getByRole("button", { name: "Remove selected from My Doors", exact: true }).click();
  await page.getByRole("button", { name: "Save selected recommendation", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.saved") || "[]"));
  expect(saved[0].anchors).toEqual(["Nina Simone"]);
  expect(saved[0].sourceEntityIds).toEqual(["seed-0"]);
  expect(saved[0].entityId).toBe("original");
  expect(saved[0].source).toBe("Nina Simone");
  expect(saved[0].mode).toBe("live");
  await page.getByRole("button", { name: "Clear conversation", exact: true }).click();
  // Dismissed confirmation must preserve the session.
  // Playwright dismisses dialogs by default.
  await expect(current(page)).toBeVisible();
});

test("prepared examples cannot masquerade as Qloo-backed evidence", async ({ page }) => {
  await setup(page, { demo: true }); await start(page); await challenge(page, "Show the evidence");
  await expect(transcript(page)).toContainText("prepared example, not a Qloo recommendation");
});

test("error retry keeps exact public payload; cancellation and leaving reject late results without losing the conversation", async ({ page }) => {
  const requests: DiscoveryRequest[] = []; let mode = "error";
  await page.route("**/api/agent/discover", async route => {
    const request = route.request().postDataJSON() as DiscoveryRequest; requests.push(request);
    if (mode === "error") return route.fulfill({ status: 503, json: { message: "Fixture debate unavailable." } });
    if (mode === "slow") await new Promise(resolve => setTimeout(resolve, 1600));
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(request, [mode === "slow" ? "late" : "a"]) }) + "\n" }).catch(() => {});
  });
  await setup(page); await start(page); await challenge(page, "Retrieve an alternative");
  await expect(page.getByRole("alert")).toContainText("Fixture debate unavailable");
  await expect(current(page).getByRole("heading", { name: "Artist original", exact: true })).toBeVisible();
  await page.getByLabel("Your private challenge").fill("New private prose must not change retry");
  mode = "success"; await page.getByRole("button", { name: "Retry exact discovery request", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "Artist a", exact: true })).toBeVisible();
  expect(requests[1]).toEqual(requests[0]);
  expect(JSON.stringify(requests)).not.toContain("private prose");
  mode = "slow"; await challenge(page, "Retrieve an alternative");
  await expect(page.getByLabel("Your private challenge")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel debate discovery", exact: true }).click();
  await page.waitForTimeout(1700);
  await expect(current(page).getByRole("heading", { name: "Artist a", exact: true })).toBeVisible();
  await challenge(page, "Retrieve an alternative");
  await page.getByRole("navigation", { name: "Discovery experiences" }).getByRole("button", { name: "What If? Explorer", exact: true }).click();
  await page.waitForTimeout(1700);
  await page.getByRole("navigation", { name: "Discovery experiences" }).getByRole("button", { name: "Discovery Debate", exact: true }).click();
  await expect(current(page).getByRole("heading", { name: "Artist a", exact: true })).toBeVisible();
  await expect(transcript(page)).not.toContainText("Artist late");
});

test("mobile uses actual consistently sized MascotArt; ambiguity and clearing have complete interactions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { original: false });
  const intro = page.locator(".discovery-debate .bridge-intro .mascot-visual");
  const introWidth = await intro.evaluate(element => element.getBoundingClientRect().width);
  const emptyWidth = await page.locator(".discovery-debate .bridge-state .mascot-visual").evaluate(element => element.getBoundingClientRect().width);
  expect(Math.abs(introWidth - emptyWidth)).toBeLessThan(1);
  await page.getByLabel("Debate interest 1", { exact: true }).fill("Nina Simone");
  await page.route("**/api/agent/discover", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(route.request().postDataJSON(), ["mobile"]) }) + "\n" });
  });
  await page.getByRole("button", { name: "Generate a recommendation", exact: true }).click();
  const loadingWidth = await page.locator(".discovery-debate .bridge-state .mascot-visual").evaluate(element => element.getBoundingClientRect().width);
  expect(Math.abs(introWidth - loadingWidth)).toBeLessThan(1);
  await expect(current(page)).toBeVisible();
  await page.getByLabel("Your private challenge").fill("Does my private situation matter?");
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not recognized");
  await page.getByLabel("Challenge action", { exact: true }).selectOption("weak");
  await page.getByRole("button", { name: "Send challenge", exact: true }).click();
  await expect(transcript(page)).toContainText("Your objection is reasonable");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".discovery-debate .bridge-intro img")).toHaveAttribute("src", /curiosity-guide(?:-still)?\.webp/);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Clear conversation", exact: true }).click();
  await expect(current(page)).toHaveCount(0);
});

test("no unseen results keeps the selected recommendation and never substitutes a repeated entity", async ({ page }) => {
  await page.route("**/api/agent/discover", route => route.fulfill({
    contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: journey(route.request().postDataJSON(), ["original"]) }) + "\n",
  }));
  await setup(page); await start(page); await challenge(page, "Retrieve an alternative");
  await expect(page.getByRole("heading", { name: "No unseen recommendation this time.", exact: true })).toBeVisible();
  await expect(current(page)).toContainText("Artist original");
  await expect(page.getByRole("region", { name: "Debate returned recommendations" })).toHaveCount(0);
});

test("evidence questions remain available without Qloo while live alternatives fail honestly before requesting", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/agent/discover", route => { requests++; return route.abort(); });
  await setup(page, { configured: false }); await start(page);
  await challenge(page, "Show the evidence");
  await expect(transcript(page)).toContainText("Source entity IDs: seed-0");
  await challenge(page, "Retrieve an alternative");
  await expect(page.getByRole("alert")).toContainText("working Qloo connection");
  expect(requests).toBe(0);
});

test("all three experiences and existing My Doors coexist without replacing local drafts or original discovery", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/agent/discover", route => { calls++; return route.abort(); });
  await setup(page); await start(page); await challenge(page, "Why this recommendation?");
  const originalStorage = await page.evaluate(() => localStorage.getItem("opendoor.journey"));
  const navigation = page.getByRole("navigation", { name: "Discovery experiences" });
  await navigation.getByRole("button", { name: "Taste Bridge", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Taste Bridge", exact: true })).toBeVisible();
  await page.getByLabel("Person 1 name", { exact: true }).fill("Private group label");
  await navigation.getByRole("button", { name: "What If? Explorer", exact: true }).click();
  await page.getByRole("button", { name: "Use this starting point", exact: true }).click();
  await page.getByLabel("Your private what-if scenario").fill("Private scenario retained");
  await navigation.getByRole("button", { name: "Discovery Debate", exact: true }).click();
  await expect(transcript(page)).toContainText("not pairwise proof");
  await expect(current(page)).toContainText("Artist original");
  await navigation.getByRole("button", { name: "Taste Bridge", exact: true }).click();
  await expect(page.getByLabel("Person 1 name", { exact: true })).toHaveValue("Private group label");
  await navigation.getByRole("button", { name: "What If? Explorer", exact: true }).click();
  await expect(page.getByLabel("Your private what-if scenario")).toHaveValue("Private scenario retained");
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: /^My Doors/ }).click();
  await expect(page.getByRole("heading", { name: "My Doors", exact: true })).toBeVisible();
  await expect(page.locator(".saved-row h3")).toHaveText("Artist original");
  expect(await page.evaluate(() => localStorage.getItem("opendoor.journey"))).toBe(originalStorage);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Private group label");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Private scenario retained");
  expect(calls).toBe(0);
});
