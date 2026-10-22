import { expect, test, type Page } from "@playwright/test";

const storageKey = "opendoor.lab.v1";
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), storageKey);

async function fixture(page: Page, personal = false) {
  const calls: { source: string; input: any }[] = [];
  let fail = false;
  let credentialRequests = 0;
  await page.addInitScript(source => sessionStorage.setItem("opendoor.qloo.source", source), personal ? "personal" : "shared");
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: personal,
    connectionExpiresAt: personal ? new Date(Date.now() + 3_600_000).toISOString() : null,
    agent: "Browser test fixture", demoAvailable: true,
  } }));
  await page.route("**/api/qloo/connection", route => {
    credentialRequests++;
    return route.abort();
  });
  await page.route("**/api/agent/discover", async route => {
    const input = route.request().postDataJSON();
    calls.push({ source: route.request().headers()["x-qloo-connection"], input });
    if (fail) return route.fulfill({ status: 503, json: { message: "Test connection temporarily unavailable" } });
    const suffix = `${input.depth}-${input.intent}-${input.iteration}`;
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: {
      mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
      context: input.context, anchors: input.anchors.map((anchor: any) => anchor.label),
      categories: Object.fromEntries(input.anchors.map((anchor: any) => [anchor.label, anchor.category])),
      iteration: input.iteration, resolvedAnchors: [], tools: [], notices: [],
      graph: { nodes: [], edges: [] },
      doors: ["shared", suffix].map((id, index) => ({
        id: `door-${id}`, entityId: `entity-${id}`, entityType: input.resultTypes?.[0] || "artist",
        tier: index ? "Adjacent" : "Familiar", title: index ? `Discovery ${suffix}` : "A shared discovery",
        category: "Music", kind: "Music", description: "A browser-test fixture",
        source: input.anchors[0].label, why: "Recorded cultural connection",
        evidence: "Test fixture only, not actual Qloo evidence", thread: "A creative connection",
      })),
    } }) + "\n" });
  });
  return { calls, setFailure: (value: boolean) => { fail = value; }, credentialRequests: () => credentialRequests };
}

async function begin(page: Page) {
  await page.goto("/lab");
  await page.getByLabel("Cultural interest", { exact: true }).fill("Miles Davis");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("combobox", { name: "Category for Miles Davis", exact: true }).selectOption("Music");
  await page.getByRole("button", { name: /^Start exploring/ }).click();
  await expect(page.locator(".lab-discovery")).toHaveCount(2);
}

async function wildBranch(page: Page) {
  await page.locator(".lab-direction").filter({ hasText: "Take the Wild Door" }).click();
  await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
  await expect(page.locator(".lab-busy")).toHaveCount(0);
}

test("shared Demo opens a real-provider Lab path in one click and automatically compares independent siblings", async ({ page }) => {
  const mock = await fixture(page);
  await begin(page);
  const first = await stored(page);
  expect(first.current.mode).toBe("live");
  expect(first.checkpoints).toHaveLength(1);
  expect(first.branches).toHaveLength(1);
  await page.getByLabel("Budget", { exact: true }).fill("Under $30");
  await wildBranch(page);
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
  const second = await stored(page);
  expect(second.branches[0].snapshot.candidates).toEqual(first.branches[0].snapshot.candidates);
  expect(second.branches[1].snapshot.settings.budget).toBe("Under $30");
  expect(mock.calls.map(call => call.source)).toEqual(["shared", "shared"]);
  expect(mock.calls[1].input.depth).not.toBe(mock.calls[0].input.depth);
  expect(mock.calls[1].input.anchors).toEqual(mock.calls[0].input.anchors);
  await expect(page.locator(".lab-post-history")).toContainText("A shared discovery");
  await page.locator(".lab-sibling-card input[type=checkbox]").first().uncheck();
  await expect(page.locator(".lab-compare-branch")).toHaveCount(0);
  await page.locator(".lab-sibling-card input[type=checkbox]").first().check();
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
  await page.locator(".lab-compare").screenshot({ path: "generated-artifacts/lab-comparison-desktop.png" });
  await page.reload();
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
});

test("a personal Qloo connection already selected in this session is reused without requesting credentials", async ({ page }) => {
  const mock = await fixture(page, true);
  await begin(page);
  expect(mock.calls).toHaveLength(1);
  expect(mock.calls[0].source).toBe("personal");
  expect(mock.credentialRequests()).toBe(0);
  expect((await stored(page)).current.mode).toBe("live");
});

test("a failed live branch preserves siblings, shows an empty failed path and retries without demo fallback", async ({ page }) => {
  const mock = await fixture(page);
  await begin(page);
  const first = (await stored(page)).branches[0];
  mock.setFailure(true);
  await wildBranch(page);
  await expect(page.getByRole("alert").filter({ hasText: /No Demo fallback|No prepared|temporarily unavailable/ }).first()).toBeVisible();
  const failed = await stored(page);
  expect(failed.branches[0]).toEqual(first);
  expect(failed.current.candidates).toEqual([]);
  expect(failed.current.mode).toBe("live");
  mock.setFailure(false);
  await page.locator(".lab-results").getByRole("button", { name: /Try again|Retry|Explore again/ }).first().click();
  await expect(page.locator(".lab-discovery")).toHaveCount(2);
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
});

test("reference-style branch cards rename, continue independently and compare recorded discoveries", async ({ page }) => {
  const mock = await fixture(page);
  await begin(page);
  await expect(page.locator(".lab-sibling-card")).toHaveCount(1);
  const original = await stored(page);
  const name = page.locator(".lab-branch-name-input").first();
  await name.fill("My familiar route");
  await name.press("Enter");
  await expect.poll(async () => (await stored(page)).branches[0].name).toBe("My familiar route");
  await wildBranch(page);
  await expect(page.locator(".lab-sibling-card")).toHaveCount(2);
  await expect(page.locator(".lab-shared-checkpoint")).toContainText("Miles Davis");
  await expect(page.getByRole("heading", { name: "Observable differences", exact: true })).toBeVisible();
  const adventureRow = page.locator(".lab-difference-table tr").filter({ has: page.getByRole("rowheader", { name: "Adventure", exact: true }) });
  await expect(adventureRow).toContainText("familiar");
  await expect(adventureRow).toContainText("unexpected");
  const siblingBefore = (await stored(page)).branches[1];
  await page.locator(".lab-sibling-card").first().getByRole("button", { name: "Explore this path", exact: true }).click();
  await expect.poll(() => mock.calls.length).toBe(3);
  await expect.poll(async () => (await stored(page)).branches[0].snapshot.history.length).toBe(original.branches[0].snapshot.history.length + 1);
  expect((await stored(page)).branches[1]).toEqual(siblingBefore);
  await page.reload();
  await expect(page.locator(".lab-branch-name-input").first()).toHaveValue("My familiar route");
  await page.locator(".lab-sibling-grid").screenshot({ path: "generated-artifacts/lab-reference-branches.png" });
  await page.locator(".lab-compare-findings").screenshot({ path: "generated-artifacts/lab-reference-findings.png" });
});

test("phone branch map and comparison remain readable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await begin(page);
  await wildBranch(page);
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator(".lab-map").screenshot({ path: "generated-artifacts/lab-map-mobile.png" });
  await page.locator(".lab-compare").screenshot({ path: "generated-artifacts/lab-comparison-mobile.png" });
});
