import { expect, test } from "@playwright/test";

test("Qloo is prominent before entry, without treating a configured connection as a completed retrieval", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: { qlooConfigured: true, sharedQlooConfigured: true } }));
  await page.goto("/");
  await expect(page.locator(".brand-caption")).toContainText("Qloo");
  await expect(page.locator('[data-qloo-grounding="overview"]')).toContainText("Qloo Search");
  await page.getByRole("button", { name: "Open the door", exact: true }).click();
  const skip = page.getByRole("button", { name: "Skip animation", exact: true });
  if (await skip.isVisible()) await skip.click();
  const grounding = page.locator('[data-qloo-grounding="ready"]');
  await expect(grounding).toBeVisible();
  await expect(grounding).toContainText("explore to retrieve results");
  await expect(page.locator('[data-qloo-grounding="received"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await expect(page.locator('[data-qloo-grounding="sample"]')).toContainText("not Qloo results");
  await expect(page.getByRole("button", { name: "Find my doors", exact: true })).toBeVisible();
});

test("unavailable Qloo and authored samples stay distinct in both Discovery and Lab", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: { qlooConfigured: false, sharedQlooConfigured: false } }));
  await page.goto("/?explore=1");
  await expect(page.locator('[data-qloo-grounding="unavailable"]')).toContainText("needed for live discovery");
  await expect(page.getByRole("button", { name: "Explore with Qloo", exact: true })).toBeDisabled();
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: "Discovery Lab", exact: true }).click();
  await expect(page.locator('[data-qloo-grounding="unavailable"]')).toBeVisible();
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await expect(page.locator('[data-qloo-grounding="sample"]')).toContainText("not evidence");
});

test("a completed live response earns the received label, not connection configuration alone", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: { qlooConfigured: true, sharedQlooConfigured: true } }));
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON();
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: {
      mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
      context: input.context, anchors: input.anchors.map((item: { label: string }) => item.label),
      categories: Object.fromEntries(input.anchors.map((item: { label: string; category: string }) => [item.label, item.category])),
      iteration: 0, resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] }, doors: [],
    } }) + "\n" });
  });
  await page.goto("/companies/discover?type=hospitality");
  await expect(page.locator('[data-qloo-grounding="ready"]')).toBeVisible();
  await expect(page.locator('[data-qloo-grounding="received"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator('[data-qloo-grounding="received"]')).toContainText("Qloo response received");
});

test("Qloo grounding is consistent across company examples and the method page, including on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies");
  await expect(page.locator(".company-hero-copy")).toContainText("Qloo grounds cultural discovery in its taste graph");
  await expect(page.locator(".company-roadmap")).toContainText("not available yet");
  await page.goto("/?view=how");
  await expect(page.locator(".architecture-flow")).toContainText("Qloo Search resolves named interests");
  await expect(page.locator(".architecture-flow")).toContainText("Qloo Insights retrieves cultural connections");
  await expect(page.locator(".architecture-demo")).toContainText("Qloo describes its taste graph as spanning 250M+ entities");
  await expect(page.locator(".trust-box")).toContainText("Without a successful Qloo response");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
