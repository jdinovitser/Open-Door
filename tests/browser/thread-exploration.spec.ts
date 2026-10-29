import { expect, test, type Page } from "@playwright/test";

test("repeated demo continuation opens distinct useful steps and can return to the previous recommendations", async ({ page }) => {
  let liveCalls = 0;
  await page.route("**/api/agent/discover", route => { liveCalls++; return route.abort(); });
  await page.goto("/demo");
  const originalTitles = await page.locator(".door-card > .door-top h3").allTextContents();
  await page.locator(".door-card").first().locator(".door-preview").click();
  // Continuing a displayed Demo must not silently become Live because of a form toggle.
  await page.locator(".friendly-connection > summary").click();
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  const first = page.locator(".door-card.is-expanded .door-result-expanded");
  await expect(first).toBeVisible();
  await expect(first).toContainText("Try this first");
  await expect(first).toContainText("independent cinema");
  await expect(page.getByRole("region", { name: "Thread exploration" })).toContainText(originalTitles[0]);
  const secondTitles = await page.locator(".door-card > .door-top h3").allTextContents();
  expect(secondTitles).not.toEqual(originalTitles);
  await expect(first.locator("h4")).toBeFocused();
  await first.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect(first).toBeVisible();
  await expect(first).toContainText("independent cinema");
  const thirdTitles = await page.locator(".door-card > .door-top h3").allTextContents();
  expect(thirdTitles).not.toEqual(secondTitles);
  expect(liveCalls).toBe(0);
  await page.screenshot({ path: "generated-artifacts/thread-continuation-desktop.png" });
  await page.getByRole("button", { name: "Back to previous recommendations" }).click();
  await expect(page.locator(".door-card > .door-top h3")).toHaveText(secondTitles);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".door-card").first().locator(".door-preview").click();
  await page.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect(first).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/thread-continuation-mobile.png" });
});

async function configureLive(page: Page) {
  await page.route("**/api/status", async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), qlooConfigured: true } });
  });
}
function liveResult(input: any, title: string, entityId: string, empty = false) {
  return JSON.stringify({ type: "complete", journey: {
    mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
    context: input.context, anchors: input.anchors.map((item: any) => item.label),
    categories: Object.fromEntries(input.anchors.map((item: any) => [item.label, item.category])),
    iteration: input.iteration || 0, resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] },
    doors: empty ? [] : [{ id: `qloo-${entityId}`, entityId, entityType: "artist", tier: "Familiar", title,
      kind: "Music", category: "Music", source: input.anchors[0].label, why: `A returned connection from ${input.anchors[0].label}.`,
      whyNow: "Listen to a short excerpt.", evidence: "Mock Qloo retrieval for browser verification.", thread: "Listen closely" }],
  } }) + "\n";
}
async function startLive(page: Page) {
  await page.goto("/demo");
  await page.locator(".friendly-connection > summary").click();
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator(".door-card h3")).toHaveText("First returned artist");
  await page.locator(".door-preview").click();
}

test("live continuation has visible loading, keeps prior results on failure, retries using the selected entity and opens the result", async ({ page }) => {
  await configureLive(page);
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: any[] = [];
  await page.route("**/api/agent/discover", async route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    calls++;
    if (calls === 2) {
      await gate;
      await route.fulfill({ status: 503, json: { message: "Test retrieval failure" } });
      return;
    }
    await route.fulfill({ contentType: "application/x-ndjson",
      body: liveResult(input, calls === 1 ? "First returned artist" : "A deeper returned artist", calls === 1 ? "first-entity" : "next-entity") });
  });
  await startLive(page);
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).first().click();
  await page.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  const notice = page.getByRole("region", { name: "Thread exploration" });
  await expect(notice).toContainText("Finding new Qloo connections");
  await expect(notice).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".expanded-next-actions .primary-btn:visible")).toBeDisabled();
  release();
  await expect(notice.getByRole("alert")).toContainText("Your previous recommendations are still here");
  await expect(page.locator(".door-card h3")).toHaveText("First returned artist");
  await notice.getByRole("button", { name: "Retry this thread" }).click();
  await expect(page.locator(".door-card.is-expanded h4")).toHaveText("A deeper returned artist");
  expect(requests[1].resolvedEntities).toEqual([{ label: "First returned artist", category: "Music", entityId: "first-entity", entityType: "artist" }]);
  expect(requests[1].excludedEntityIds).toContain("first-entity");
  expect(requests[1].iteration).toBe(1);
  await expect(page.locator(".journey-badge")).toContainText("Live Qloo");
  await page.getByRole("button", { name: "Back to previous recommendations" }).click();
  await expect(page.locator(".door-card h3")).toHaveText("First returned artist");
});

test("an empty live continuation explains what happened and offers the original recommendations without a demo fallback", async ({ page }) => {
  await configureLive(page);
  let calls = 0;
  await page.route("**/api/agent/discover", async route => {
    calls++;
    await route.fulfill({ contentType: "application/x-ndjson",
      body: liveResult(route.request().postDataJSON(), "First returned artist", "first-entity", calls > 1) });
  });
  await startLive(page);
  await page.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect(page.getByRole("region", { name: "Thread exploration" })).toContainText("Qloo didn’t find any more recommendations");
  await expect(page.locator(".door-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to previous recommendations" }).click();
  await expect(page.locator(".door-card h3")).toHaveText("First returned artist");
});
