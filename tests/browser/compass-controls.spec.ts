import { expect, test } from "@playwright/test";

const intentions = ["Find my people", "Go deeper", "Try something new"];

function responseFor(input: any) {
  return JSON.stringify({ type: "complete", journey: {
    mode: "live", city: input.location, occasion: input.occasion,
    intent: input.intent, depth: input.depth, context: input.context,
    anchors: input.anchors.map((item: any) => item.label),
    categories: Object.fromEntries(input.anchors.map((item: any) => [item.label, item.category])),
    iteration: input.iteration || 0, resolvedAnchors: [], tools: [], notices: [],
    graph: { nodes: [], edges: [] },
    doors: [{ id: `result-${input.iteration}`, entityId: `entity-${input.iteration}`, entityType: "artist",
      tier: "Familiar", title: `Ideas for ${input.intent}`, category: "Music", kind: "Music",
      source: input.anchors[0].label, why: "Fixture cultural connection.",
      evidence: "Browser-test fixture, not actual Qloo evidence.", thread: "Listen closely",
      whyNow: "Try a short excerpt." }],
  } }) + "\n";
}

test("all three compass buttons refresh prepared ideas and preserve edited categories", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/agent/discover", route => { requests++; return route.abort(); });
  await page.goto("/demo");
  const categories = page.locator(".dna-category");
  const firstName = await categories.first().getAttribute("aria-label");
  await categories.first().selectOption("Music");
  const compass = page.getByRole("region", { name: "Reset the compass", exact: true });
  // The compass acts on displayed results, not an unrelated form-mode selection.
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  for (const intention of intentions) {
    await compass.getByRole("button", { name: intention, exact: true }).click();
    await expect(compass.getByRole("button", { name: intention, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(compass.getByRole("status")).toContainText(`New ideas ready for “${intention}”`);
    await expect(page.getByRole("combobox", { name: firstName!, exact: true })).toHaveValue("Music");
    await expect(page.locator(".door-card").first()).toBeVisible();
  }
  expect(requests).toBe(0);
});

test("live compass reports loading, failure and success locally and sends each intention with edited anchors", async ({ page }) => {
  const requests: any[] = [];
  let failNext = false;
  let release!: () => void;
  let gate: Promise<void> | null = null;
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: false,
    agent: "Fixture", demoAvailable: true,
  } }));
  await page.route("**/api/agent/discover", async route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    if (gate) { const waiting = gate; gate = null; await waiting; }
    if (failNext) {
      failNext = false;
      return route.fulfill({ status: 503, json: { message: "Fixture connection failed." } });
    }
    return route.fulfill({ contentType: "application/x-ndjson", body: responseFor(input) });
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator(".door-card h3")).toHaveText("Ideas for Try something new");
  const anchors = requests[0].anchors.map((anchor: any) => anchor.label);
  const category = page.locator(".dna-category").first();
  await category.selectOption("Books");
  const compass = page.getByRole("region", { name: "Reset the compass", exact: true });
  // A prepared-example form selection must not silently turn live results into samples.
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).first().click();
  failNext = true;
  gate = new Promise(resolve => { release = resolve; });
  await compass.getByRole("button", { name: "Find my people", exact: true }).click();
  await expect(compass).toHaveAttribute("aria-busy", "true");
  await expect(compass.getByRole("status")).toContainText("Looking for ideas");
  await expect(compass.getByRole("button", { name: "Go deeper", exact: true })).toBeDisabled();
  await expect(page.locator(".door-card h3")).toHaveText("Ideas for Try something new");
  release();
  await expect(compass.getByRole("alert")).toContainText("previous recommendations haven’t changed");
  await expect(page.locator(".door-card h3")).toHaveText("Ideas for Try something new");
  for (const intention of intentions) {
    await compass.getByRole("button", { name: intention, exact: true }).click();
    await expect(page.locator(".door-card h3")).toHaveText(`Ideas for ${intention}`);
    await expect(compass.getByRole("status")).toContainText("New ideas ready");
    const sent = requests.at(-1);
    expect(sent.intent).toBe(intention);
    expect(sent.anchors.map((anchor: any) => anchor.label)).toEqual(anchors);
    expect(sent.anchors[0].category).toBe("Books");
  }
});

test("category dropdowns are visible, keyboard accessible and fit mobile screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  const editor = page.locator(".dna-edit");
  const dropdown = editor.getByRole("combobox").first();
  await dropdown.focus();
  await expect(dropdown).toBeFocused();
  await dropdown.selectOption("Art");
  await expect(dropdown).toHaveValue("Art");
  const style = await dropdown.evaluate(el => {
    const style = getComputedStyle(el);
    return { font: parseFloat(style.fontSize), border: parseFloat(style.borderTopWidth), height: el.getBoundingClientRect().height };
  });
  expect(style.font).toBeGreaterThanOrEqual(16);
  expect(style.border).toBeGreaterThanOrEqual(2);
  expect(style.height).toBeGreaterThanOrEqual(46);
  await editor.screenshot({ path: "generated-artifacts/category-dropdowns-mobile.png" });
  await page.locator(".compass-panel").screenshot({ path: "generated-artifacts/compass-controls-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
