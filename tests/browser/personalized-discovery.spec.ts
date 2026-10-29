import { expect, test } from "@playwright/test";

test("editable guest profile reaches retrieval, preserves private notes, and offers real destination/planner/continuation actions", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/status", route => route.fulfill({ json: { qlooConfigured: true, sharedQlooConfigured: true, demoAvailable: true } }));
  await page.route("**/api/agent/discover", route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    const next = requests.length > 1;
    const id = next ? "next-entity" : "place-entity";
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: {
      mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
      context: input.context, anchors: input.anchors.map((a: any) => a.label),
      categories: Object.fromEntries(input.anchors.map((a: any) => [a.label, a.category])), iteration: input.iteration || 0,
      resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] }, generatedAt: new Date().toISOString(),
      doors: [{ id: `qloo-${id}`, entityId: id, entityType: next ? "artist" : "place", tier: "Familiar",
        title: next ? "Next cultural idea" : "Returned garden", kind: "Qloo result", category: next ? "Music" : "Experiences",
        source: input.anchors.map((a: any) => a.label).join(", "), sourceEntityIds: ["seed"],
        why: "Returned by Qloo Insights.", now: "Explore a short introduction.", thread: "A cultural connection", evidence: "Qloo Insights",
        coordinates: next ? null : { latitude: 40.7, longitude: -73.9 },
        websiteUrl: next ? "" : "https://example.org/visit", explainability: null,
      }],
    } }) + "\n" });
  });
  await page.goto("/?explore=1");
  await page.getByLabel("Profile discovery intention").selectOption("Go deeper");
  await page.getByLabel("Profile exploration depth").selectOption("Surprise me");
  const memory = page.getByRole("region", { name: "Your discovery preferences" });
  await memory.getByText("Trip defaults · budget and movement", { exact: true }).click();
  await page.getByLabel("Profile trip budget").selectOption("Moderate");
  await page.getByLabel("Profile trip movement").selectOption("Easy walking");
  await page.locator(".friendly-brief textarea").fill("A private note not for account storage");
  await page.getByRole("button", { name: "Save these four settings" }).click();
  await expect(memory.getByRole("status")).toContainText("this browser only");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.preferences")!));
  expect(saved).toEqual({ intent: "Go deeper", depth: "Surprise me", budget: "Moderate", movement: "Easy walking" });
  await page.getByLabel("What do you already enjoy?").fill("Nina Simone");
  await page.getByLabel("Category for new anchor").selectOption("Music");
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator(".door-card h3")).toHaveText("Returned garden");
  expect(requests[0]).toMatchObject({ intent: "Go deeper", depth: "Surprise me", context: { budget: "Moderate", movement: "Easy walking" }, anchors: [{ label: "Nina Simone", category: "Music" }] });
  expect(JSON.stringify(requests[0])).not.toContain("private note");
  await page.locator(".door-preview").click();
  const details = page.locator(".door-result-expanded:visible");
  await expect(details.getByRole("heading", { name: "Your starting interest" })).toBeVisible();
  await expect(details.getByLabel("Discovery connection")).toContainText("Nina Simone");
  await expect(details.getByLabel("Discovery connection")).toContainText("more specific reason is not established");
  await expect(details.getByRole("link", { name: /View returned location/ })).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=40.7,-73.9");
  await expect(details.getByRole("link", { name: /Visit website supplied/ })).toHaveAttribute("href", "https://example.org/visit");
  await page.getByRole("button", { name: "Save Returned garden", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Returned garden from My Doors" })).toBeVisible();
  await details.getByRole("button", { name: "Add to Build My Day" }).click();
  await expect(page.getByRole("list", { name: "Editable day schedule" })).toContainText("Returned garden");
  await page.getByLabel("Profile exploration depth").selectOption("Close to home");
  await details.getByRole("button", { name: "Explore more ideas" }).click();
  await expect(page.locator(".door-card h3")).toHaveText("Next cultural idea");
  expect(requests[1]).toMatchObject({ intent: "Go deeper", depth: "Close to home", resolvedEntities: [{ entityId: "place-entity", entityType: "place" }], context: { budget: "Moderate", movement: "Easy walking" } });
  expect(requests[1].excludedEntityIds).toContain("place-entity");
  await expect(page.locator(".door-result-expanded:visible")).toContainText("Returned garden");
  await expect(page.locator(".door-result-expanded:visible").getByRole("link", { name: /View returned location|Visit website supplied/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("guest preference restore is explicit, and forgetting removes only saved settings", async ({ page }) => {
  await page.goto("/?explore=1");
  await page.getByLabel("Profile discovery intention").selectOption("Go deeper");
  await page.getByRole("button", { name: "Save these four settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Restore saved values" }).click();
  await expect(page.getByLabel("Profile discovery intention")).toHaveValue("Go deeper");
  await page.getByRole("button", { name: "Forget saved settings" }).click();
  await expect(page.getByRole("button", { name: "Restore saved values" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.preferences"))).toBeNull();
});
