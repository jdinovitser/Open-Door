import { test, expect, type Page } from "@playwright/test";

const storageKey = "opendoor.lab.v1";
async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || "null"), storageKey);
}
async function begin(page: Page) {
  await page.goto("/lab");
  await page.getByLabel("Cultural interest", { exact: true }).fill("experimental jazz");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("button", { name: /^Start exploring/ }).click();
  page.once("dialog", dialog => dialog.accept("Shared start"));
  await page.getByRole("button", { name: "Save checkpoint", exact: true }).click();
  await expect(page.locator(".lab-checkpoint")).toHaveCount(1);
}
async function branch(page: Page, name: string) {
  await page.locator(".lab-direction").filter({ hasText: name }).click();
  await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
  await expect(page.locator(".lab-discovery")).toHaveCount(3);
  await expect(page.locator(".lab-busy")).toHaveCount(0);
}
test("checkpoint, independent siblings, comparison, continuation, fork and reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await begin(page);
  await branch(page, "Stay in Your World");
  await page.locator(".lab-discovery").first().getByRole("button", { name: "Keep", exact: true }).click();
  const first = await stored(page);
  const firstBranch = first.branches[0];
  await page.getByRole("button", { name: "Return here", exact: true }).first().click();
  await branch(page, "Take the Wild Door");
  let state = await stored(page);
  expect(state.branches).toHaveLength(2);
  expect(state.branches[0]).toEqual(firstBranch);
  expect(state.current.history).toHaveLength(1);
  const selectedTitle = state.current.candidates[0].title;
  await page.locator(".lab-discovery").first().getByRole("button", { name: "Open the next door", exact: true }).click();
  await expect.poll(async () => (await stored(page)).current.history.length).toBe(2);
  state = await stored(page);
  expect(state.current.anchors).toEqual([selectedTitle]);
  expect(state.branches[0]).toEqual(firstBranch);
  await page.getByRole("combobox", { name: "Shared checkpoint", exact: true }).selectOption(state.checkpoints[0].id);
  await page.locator(".lab-compare-picker input").nth(0).check();
  await page.locator(".lab-compare-picker input").nth(1).check();
  await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
  await expect(page.locator(".lab-compare-branch").first()).toContainText("Kept for this journey");
  await page.locator(".lab-compare-branch").first().getByRole("button", { name: "Favorite branch", exact: true }).click();
  expect((await stored(page)).favorites[state.checkpoints[0].id]).toBe(firstBranch.id);
  await page.locator(".lab-compare-branch").first().getByRole("button", { name: "Fork from this discovery", exact: true }).first().click();
  state = await stored(page);
  expect(state.checkpoints).toHaveLength(2);
  expect(state.activeBranchId).toBeNull();
  expect(state.checkpoints[1].parentBranchId).toBe(firstBranch.id);
  expect(state.branches[0]).toEqual(firstBranch);
  await page.reload();
  await expect(page.locator(".lab-checkpoint")).toHaveCount(2);
  expect((await stored(page)).branches).toHaveLength(2);
  expect(errors).toEqual([]);
});
test("edited constraints apply to new branches; all six strategies can be explored", async ({ page }) => {
  await begin(page);
  const names = ["Stay in Your World", "Follow the Thread", "Cross Into Another World", "Find Your People", "Take the Wild Door", "Make It Real"];
  const signatures: string[] = [];
  for (const name of names) {
    await page.getByRole("button", { name: "Return here", exact: true }).first().click();
    await page.getByLabel("Budget", { exact: true }).fill("No purchase");
    await page.getByLabel("Location", { exact: true }).fill("Brooklyn");
    await page.getByRole("combobox", { name: "Time available", exact: true }).selectOption("Weekend");
    await page.getByRole("combobox", { name: "Occasion", exact: true }).selectOption("Family activity");
    await branch(page, name);
    const state = await stored(page);
    expect(state.current.settings.budget).toBe("No purchase");
    expect(state.current.settings.time).toBe("Weekend");
    signatures.push(state.current.candidates.map((item: { title: string }) => item.title).join("|"));
    if (name === "Cross Into Another World") expect(state.current.candidates.every((item: { domain: string }) => item.domain === "Art")).toBeTruthy();
    if (name === "Make It Real") expect(state.current.candidates[0].plan.join(" ")).toContain("Brooklyn");
  }
  expect(new Set(signatures).size).toBe(6);
  expect((await stored(page)).branches).toHaveLength(6);
  await page.locator(".lab-direction-layout").screenshot({ path: "generated-artifacts/lab-directions-desktop.png" });
});
test("rename, confirmed deletion, restoration and fresh journey retain siblings", async ({ page }) => {
  await begin(page);
  await branch(page, "Stay in Your World");
  page.once("dialog", dialog => dialog.accept("My close study"));
  await page.locator(".lab-branch-row").first().getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.locator(".lab-branch-row").first()).toContainText("My close study");
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator(".lab-branch-row").first().getByRole("button", { name: "Remove", exact: true }).click();
  expect((await stored(page)).branches).toHaveLength(1);
  page.once("dialog", dialog => dialog.accept());
  await page.locator(".lab-branch-row").first().getByRole("button", { name: "Remove", exact: true }).click();
  expect((await stored(page)).branches).toHaveLength(0);
  await page.getByRole("button", { name: "Return here", exact: true }).click();
  expect((await stored(page)).current.anchors).toEqual(["experimental jazz"]);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Fresh journey", exact: true }).click();
  expect((await stored(page)).checkpoints).toHaveLength(1);
  await expect(page.getByLabel("Cultural interest", { exact: true })).toBeVisible();
});
test("original prepared three-door journey imports its selected discovery without changing original saved doors", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.locator(".door-card")).toHaveCount(3);
  const title = await page.locator(".door-card h3").first().innerText();
  await page.getByRole("button", { name: /^Branch in Discovery Lab/ }).first().click();
  await expect(page.getByRole("heading", { name: /A few ways/ })).toBeVisible();
  const state = await stored(page);
  expect(state.current.anchors).toEqual([title]);
  expect(state.current.originalAnchors.length).toBeGreaterThan(0);
  expect(state.current.mode).toBe("demo");
  expect(state.current.selected.mode).toBe("demo");
});
test("corrupt storage is not overwritten and recovery requires explicit confirmation", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{"broken":true}'), storageKey);
  await page.goto("/lab");
  await expect(page.getByRole("alert").filter({ hasText: "Saved Lab data could not be read" })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe('{"broken":true}');
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Clear Lab data", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe('{"broken":true}');
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Clear Lab data", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Saved Lab data could not be read" })).toHaveCount(0);
});
test("phone layout has no horizontal overflow and keeps core controls accessible", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await begin(page);
  await branch(page, "Make It Real");
  await expect(page.getByText(/^Demo discovery mode — (Qloo credentials pending|authored sample data)\.$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect(page.locator(".lab-discovery").first().getByRole("button", { name: "Tell me more", exact: true })).toBeVisible();
  await page.locator(".lab-discovery").first().getByRole("button", { name: "Tell me more", exact: true }).click();
  await expect(page.locator(".lab-discovery").first()).toContainText("Unverified");
  await page.locator(".lab-direction-layout").screenshot({ path: "generated-artifacts/lab-directions-mobile.png" });
});
test("finite demo results have a useful empty state and unavailable browser storage is disclosed", async ({ page }) => {
  await begin(page);
  await branch(page, "Stay in Your World");
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByRole("button", { name: /^Explore this path/ }).click();
    if ((await stored(page)).current.candidates.length === 0) break;
  }
  await expect(page.getByText("No discoveries in this batch", { exact: true })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); }; });
  await page.getByLabel("Budget", { exact: true }).fill("Different budget");
  await expect(page.getByText(/This Lab is only in memory/)).toBeVisible();
});
test("historical live fixture cannot run while credentials are pending and never falls back to demo", async ({ page }) => {
  await page.route("**/api/status", async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), qlooConfigured: false } });
  });
  await begin(page);
  await branch(page, "Stay in Your World");
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const convert = (snapshot: typeof state.current) => {
      snapshot.mode = "live";
      const discoveries = [...snapshot.candidates, ...snapshot.history.flatMap((step: { discoveries: unknown[] }) => step.discoveries), ...(snapshot.selected ? [snapshot.selected] : [])];
      discoveries.forEach(item => { item.mode = "live"; item.source = "Synthetic historical-live test fixture"; });
    };
    convert(state.current);
    state.branches.forEach((branch: { snapshot: typeof state.current }) => convert(branch.snapshot));
    state.checkpoints.forEach((checkpoint: { snapshot: typeof state.current }) => convert(checkpoint.snapshot));
    localStorage.setItem(key, JSON.stringify(state));
  }, storageKey);
  await page.reload();
  await expect(page.getByText("Historical live journey", { exact: true })).toBeVisible();
  const previous = await stored(page);
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/agent/discover")) calls++; });
  await page.getByRole("button", { name: /^Explore this path/ }).click();
  await expect(page.getByRole("alert")).toContainText("Qloo is not configured");
  expect(await stored(page)).toEqual(previous);
  expect(calls).toBe(0);
});
