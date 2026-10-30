import { test, expect, type Page } from "@playwright/test";

type Input = { location: string; occasion: string; intent: string; depth: string; anchors: { label: string; category: string }[]; context: Record<string, string> };
function result(input: Input, options: { empty?: boolean; partial?: boolean; fallback?: boolean } = {}) {
  const resolved = input.anchors.filter((_, index) => !options.partial || index === 0).map((anchor, index) => ({
    ...anchor, entityId: `seed-${index}`, entityType: anchor.category === "Film" ? "movie" : "artist",
    entityName: anchor.label, exactNameMatch: true, reusedSeedEntity: false,
  }));
  return JSON.stringify({ type: "complete", journey: {
    ...input, mode: "live", city: input.location, iteration: 0,
    anchors: input.anchors.map(anchor => anchor.label),
    categories: Object.fromEntries(input.anchors.map(anchor => [anchor.label, anchor.category])),
    resolvedAnchors: resolved, graph: { nodes: [], edges: [] }, tools: [], notices: [], feedbackApplied: [],
    generatedAt: "2026-10-29T12:00:00Z",
    methodology: { agent: "fixture", llmUsed: false, qlooBase: "", qlooEndpoints: [], discoveryDistance: "ordinal", candidateOrder: "returned" },
    doors: options.empty ? [] : ["Familiar", "Adjacent", "Unexpected"].map((tier, index) => ({
      id: `qloo-result-${index}`, entityId: `result-${index}`, entityType: "artist", title: `Returned direction ${index + 1}`,
      tier, category: "Music", kind: "Artist", source: resolved.map(anchor => anchor.entityName).join(", "),
      sourceEntityIds: resolved.map(anchor => anchor.entityId), thread: "A returned thread",
      why: "Qloo fixture returned this result for the resolved inputs.", whyYou: "", whyNow: "", now: "Try a preview.",
      evidence: "Controlled browser fixture, not a real Qloo recommendation.", description: "", imageUrl: "", tags: [],
      coordinates: null, popularity: null, explainability: null,
      unexpectedCrossCategory: index === 2 && !options.fallback,
      discoveryDistance: { tier, ordinal: index + 1, rationale: "Application route label, not affinity.", isQlooScore: false },
      queryContext: { intent: input.intent, depth: input.depth, location: input.location, context: input.context },
    })),
  } }) + "\n";
}

async function setup(page: Page, limit = 5) {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: true,
    agent: "fixture", demoAvailable: true, policy: { limits: { anchorsPerRequest: limit } },
  } }));
  await page.goto("/?view=taste-bridge");
  await expect(page.getByRole("heading", { name: "Taste Bridge", exact: true })).toBeVisible();
}
async function fillPeople(page: Page, shared = false) {
  await page.getByLabel("Person 1 name", { exact: true }).fill("Private Mara");
  await page.getByLabel("Person 2 name", { exact: true }).fill("Private Theo");
  await page.getByLabel("Person 1 interest 1", { exact: true }).fill("Nina Simone");
  await page.getByLabel("Person 1 category 1", { exact: true }).selectOption("Music");
  await page.getByLabel("Person 2 interest 1", { exact: true }).fill(shared ? "Nina Simone" : "Spirited Away");
  await page.getByLabel("Person 2 category 1", { exact: true }).selectOption(shared ? "Music" : "Film");
}

test("bridge evidence, live challenge handoff, and Lab comparison preserve both paths on desktop and mobile", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    const response = JSON.parse(result(input));
    if (requests.length > 1) for (const [index, door] of response.journey.doors.entries()) {
      door.id = `qloo-alternative-${index}`; door.entityId = `alternative-${index}`; door.title = `New direction ${index + 1}`;
    }
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify(response) + "\n" });
  });
  await setup(page); await fillPeople(page);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  const card = page.getByRole("region", { name: "The Bridge", exact: true }).locator(".door-card");
  await card.locator(".door-preview").click();
  const evidence = card.locator(".connection-evidence");
  await expect(evidence).not.toHaveAttribute("open", "");
  await evidence.locator(":scope > summary").click();
  await expect(evidence).toContainText("Qloo-grounded information");
  await expect(evidence).toContainText("rule-based, not AI-generated");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await card.getByRole("button", { name: "Question or redirect this discovery", exact: true }).click();
  const debate = page.locator(".discovery-debate");
  await expect(debate.locator(".debate-selected h2")).toHaveText("Returned direction 2");
  await debate.getByRole("button", { name: "Retrieve something more unexpected", exact: true }).click();
  await debate.getByRole("button", { name: "Send challenge", exact: true }).click();
  const comparison = page.getByRole("region", { name: "Original and alternative comparison" });
  await expect(comparison).toContainText("Returned direction 2");
  await expect(comparison).toContainText("New direction 1");
  expect(requests).toHaveLength(2);
  expect(requests[1].resolvedEntities).toEqual([{ label: "Returned direction 2", category: "Music", entityId: "result-1", entityType: "artist" }]);
  expect(requests[1].feedback).toContain("Too familiar");
  expect(JSON.stringify(requests[1])).not.toContain("Private");
  await comparison.getByRole("button", { name: "Preserve both paths in Discovery Lab", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare branches", exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.lab.v1") || "{}"));
  expect(stored.branches).toHaveLength(2);
  expect(stored.branches[0].snapshot.candidates[0].title).toBe("Returned direction 2");
  expect(stored.branches[1].snapshot.candidates[0].title).toBe("New direction 1");
  expect(JSON.stringify(stored)).not.toContain("Private");
  expect(requests).toHaveLength(2); // Importing evidence is not another query.
  await page.reload();
  await expect(page.locator(".lab-sibling-card")).toHaveCount(2);
});

test("bridge What If handoff captures the original and preserves a returned alternative", async ({ page }) => {
  let count = 0;
  await page.route("**/api/agent/discover", route => {
    const response = JSON.parse(result(route.request().postDataJSON()));
    count++;
    if (count > 1) for (const door of response.journey.doors) {
      door.id += "-paris"; door.entityId += "-paris"; door.title += " in Paris";
    }
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify(response) + "\n" });
  });
  await setup(page); await fillPeople(page);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  const card = page.getByRole("region", { name: "The Bridge", exact: true }).locator(".door-card");
  await card.locator(".door-preview").click();
  await card.getByRole("button", { name: "Try a What If? · keep this original", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Original starting point" })).toContainText("Returned direction 2");
  await page.getByLabel(/^Alternative city/).fill("Paris");
  await page.getByRole("button", { name: "Explore this what-if", exact: true }).click();
  await expect(page.locator(".what-if-comparison")).toContainText("in Paris");
  await page.getByRole("button", { name: "Preserve both paths in Discovery Lab", exact: true }).click();
  await expect(page.locator(".lab-sibling-card")).toHaveCount(2);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.lab.v1") || "{}"));
  expect(stored.branches[0].snapshot.candidates.map((door: { title: string }) => door.title)).not.toContain("Returned direction 2 in Paris");
  expect(stored.branches[1].snapshot.settings.location).toBe("Paris");
  expect(count).toBe(2);
});

test("a group journey uses the same returned results in Discover without another Qloo request", async ({ page }) => {
  let count = 0;
  await page.route("**/api/agent/discover", route => { count++; return route.fulfill({ contentType: "application/x-ndjson", body: result(route.request().postDataJSON()) }); });
  await setup(page); await fillPeople(page);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await page.getByRole("button", { name: "Plan this journey together", exact: true }).click();
  await expect(page.locator("#journey-result")).toBeVisible();
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.journey") || "{}"));
  expect(current.anchors).toEqual(["Nina Simone", "Spirited Away"]);
  expect(current.doors.map((door: { entityId: string }) => door.entityId)).toEqual(["result-0", "result-1", "result-2"]);
  expect(JSON.stringify(current)).not.toContain("Private");
  expect(count).toBe(1);
});

test("different interests: real request shape, truthful attribution, live saves, existing card and continuation", async ({ page }) => {
  const requests: { input: Input; source: string | undefined }[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as Input;
    requests.push({ input, source: route.request().headers()["x-qloo-connection"] });
    return route.fulfill({ contentType: "application/x-ndjson", body: result(input) });
  });
  await setup(page);
  await fillPeople(page);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  const results = page.getByRole("region", { name: "Taste Bridge results" });
  await expect(results).toContainText("Private Mara");
  await expect(results).toContainText("Private Theo");
  await expect(results).toContainText("not individual affinity scores or pairwise evidence");
  expect(JSON.stringify(requests[0].input)).not.toContain("Private");
  expect(requests[0].input.anchors).toHaveLength(2);
  expect(requests[0].source).toBe("shared");
  for (const name of ["Shared Ground", "The Bridge", "The Wild Card"]) {
    await expect(page.getByRole("region", { name, exact: true }).locator(".door-card")).toHaveCount(1);
  }
  await results.getByRole("button", { name: "Save Returned direction 1", exact: true }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.saved") || "[]"));
  expect(stored[0].mode).toBe("live");
  expect(stored[0].entityId).toBe("result-0");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("Private Mara");
  const first = results.locator(".door-card").first();
  await first.locator(".door-preview").click();
  await expect(first.locator("h4")).toHaveText("Returned direction 1");
  await first.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  const continuation = requests[1].input as Input & { resolvedEntities: unknown[]; excludedEntityIds: string[] };
  expect(continuation.resolvedEntities).toEqual([{ label: "Returned direction 1", category: "Music", entityId: "result-0", entityType: "artist" }]);
  expect(continuation.excludedEntityIds).toContain("result-0");
  await expect(page.locator("#journey-result")).toBeVisible();
  await page.getByRole("navigation", { name: "Discovery experiences" }).getByRole("button", { name: "Taste Bridge" }).click();
  await expect(page.getByLabel("Person 1 name", { exact: true })).toHaveValue("Private Mara");
  await expect(results).toBeVisible();
});

test("similar interests deduplicate; the personal connection is honored; edits do not rewrite result attribution", async ({ page }) => {
  const requests: { input: Input; source: string | undefined }[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as Input;
    requests.push({ input, source: route.request().headers()["x-qloo-connection"] });
    return route.fulfill({ contentType: "application/x-ndjson", body: result(input) });
  });
  await setup(page);
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await fillPeople(page, true);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  const results = page.getByRole("region", { name: "Taste Bridge results" });
  await expect(results).toContainText("personal connection");
  expect(requests[0].input.anchors).toHaveLength(1);
  expect(requests[0].source).toBe("personal");
  await expect(results).toContainText("Private Mara");
  await expect(results).toContainText("Private Theo");
  await page.getByLabel("Person 1 name", { exact: true }).fill("Changed local label");
  await expect(results).not.toContainText("Changed local label");
});

test("participant bounds, editable categories/interests, removal and server limit validation on mobile", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/agent/discover", route => { calls++; return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, 2);
  await expect(page.getByRole("button", { name: "Remove person 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("every person");
  await fillPeople(page);
  for (let index = 0; index < 3; index++) await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add person", exact: true })).toBeDisabled();
  for (let index = 3; index <= 5; index++) await page.getByLabel(`Person ${index} interest 1`, { exact: true }).fill(`Distinct interest ${index}`);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at most 2");
  expect(calls).toBe(0);
  for (let index = 5; index >= 3; index--) await page.getByRole("button", { name: `Remove person ${index}`, exact: true }).click();
  await page.getByRole("button", { name: "Remove person 2 interest 1", exact: true }).click();
  await expect(page.getByLabel("Person 2 interest 1", { exact: true })).toHaveCount(0);
  await page.locator(".bridge-person").nth(1).getByRole("button", { name: "Add interest", exact: true }).click();
  await expect(page.getByLabel("Person 2 interest 1", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const image = page.locator(".bridge-intro .mascot-visual img");
  await expect(image).toHaveAttribute("src", /curiosity-guide(?:-still)?\.webp/);
  const introWidth = await image.evaluate(element => element.getBoundingClientRect().width);
  const emptyWidth = await page.locator(".bridge-state .mascot-visual img").evaluate(element => element.getBoundingClientRect().width);
  expect(Math.abs(introWidth - emptyWidth)).toBeLessThan(1);
});

test("partial resolution, missing wild card, API error retry, empty results and cancel have honest states", async ({ page }) => {
  let mode = "partial";
  await page.route("**/api/agent/discover", async route => {
    if (mode === "error") return route.fulfill({ status: 503, json: { message: "Fixture connection unavailable." } });
    if (mode === "loading") return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "stage", label: "Resolving interests", id: "resolve", status: "running" }) + "\n" });
    return route.fulfill({ contentType: "application/x-ndjson", body: result(route.request().postDataJSON(), { partial: mode === "partial", fallback: mode === "partial", empty: mode === "empty" }) });
  });
  await setup(page);
  await fillPeople(page);
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  const results = page.getByRole("region", { name: "Taste Bridge results" });
  await expect(results).toContainText("No supported the wild card returned");
  await expect(results).toContainText("Another direction, not a confirmed wild card");
  await results.getByText("Review how Qloo resolved each interest").click();
  await expect(results).toContainText("Not resolved; not attributed");
  const contributors = page.locator(".bridge-contributors").first();
  await expect(contributors).toContainText("Private Mara");
  await expect(contributors).not.toContainText("Private Theo");
  mode = "error";
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture connection unavailable");
  await expect(results).toContainText("Returned direction 1");
  mode = "empty";
  await page.getByRole("button", { name: "Retry discovery", exact: true }).click();
  await expect(results).toContainText("No supported results this time");
  await expect(results.locator(".door-card")).toHaveCount(0);
  // A deliberately delayed response lets the real cancellation control abort the stream.
  await page.unroute("**/api/agent/discover");
  await page.route("**/api/agent/discover", async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.fulfill({ contentType: "application/x-ndjson", body: result(route.request().postDataJSON()) }).catch(() => {});
  });
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel discovery", exact: true })).toBeVisible();
  await expect(page.getByLabel("Person 1 name", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel discovery", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Discovery cancelled");
  await expect(page.getByLabel("Person 1 name", { exact: true })).toBeEnabled();
  await page.waitForTimeout(1900);
  await expect(results.locator(".door-card")).toHaveCount(0);
});

test("all five participants can contribute within the five-anchor budget", async ({ page }) => {
  const requests: Input[] = [];
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON() as Input;
    requests.push(input);
    return route.fulfill({ contentType: "application/x-ndjson", body: result(input) });
  });
  await setup(page);
  await fillPeople(page);
  for (let index = 3; index <= 5; index++) {
    await page.getByRole("button", { name: "Add person", exact: true }).click();
    await page.getByLabel(`Person ${index} interest 1`, { exact: true }).fill(`Named cultural input ${index}`);
    await page.getByLabel(`Person ${index} category 1`, { exact: true }).selectOption("Books");
  }
  await page.getByRole("button", { name: "Find our bridge", exact: true }).click();
  await expect(page.getByRole("region", { name: "Taste Bridge results" })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].anchors).toHaveLength(5);
  const contributors = page.locator(".bridge-contributors").first();
  for (const label of ["Private Mara", "Private Theo", "Person 3", "Person 4", "Person 5"]) {
    await expect(contributors).toContainText(label);
  }
});
