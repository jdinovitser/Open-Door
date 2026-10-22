import { expect, test } from "@playwright/test";

const cases = [
  { id: "personal-style", label: "Personal Style", text: "Understated colors and tactile details suit my everyday routine.", outcome: "colors, textures" },
  { id: "age-aware", label: "Age-Aware", text: "I want to explore independently at my own pace, with opportunities to pause.", outcome: "self-directed" },
  { id: "wellbeing", label: "Health & Wellbeing", text: "Quiet, seated, flexible timing and low energy today.", outcome: "seated or at-home" },
  { id: "custom", label: "Custom / Anything Else", text: "Limited time and a small budget, exploring solo.", outcome: "free access" },
];

for (const item of cases) {
  test(`${item.label} is findable in main discovery and shapes local guidance and Lab`, async ({ page }) => {
    await page.goto("/demo");
    const selector = page.getByRole("combobox", { name: "Personal considerations", exact: true });
    await expect(selector).toBeVisible();
    await selector.selectOption(item.id);
    await expect(page.getByRole("textbox", { name: "Your scenario", exact: true })).not.toHaveValue("");
    await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill(item.text);
    await page.getByRole("button", { name: "Find my doors", exact: true }).click();
    await page.locator(".door-preview").first().click();
    const result = page.locator(".door-card.is-expanded .door-result-expanded");
    await expect(result).toBeVisible();
    await expect(selector).toHaveValue(item.id);
    await expect(result.getByRole("region", { name: "Local personal considerations" })).toContainText("You told us:");
    await expect(result.locator(".scenario-result")).toContainText(item.text);
    await expect(result.locator(".scenario-result ul")).toContainText(item.outcome);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await result.getByRole("button", { name: "Branch in Discovery Lab" }).click();
    await expect(page.getByRole("textbox", { name: "Your scenario", exact: true })).toHaveValue(item.text);
    await expect(page.getByRole("combobox", { name: "Lab scenario", exact: true })).toHaveValue(item.id);
  });
}

test("expanded recommendations keep save, feedback, evidence and deeper exploration without an overlay", async ({ page }) => {
  await page.goto("/demo");
  const card = page.locator(".door-card").first();
  const title = await card.locator("h3").innerText();
  await card.locator(".door-preview").click();
  await expect(page).toHaveURL(/\/demo$/);
  const result = card.locator(".door-result-expanded");
  await expect(result).toBeVisible();
  await expect(result.locator("h4")).toHaveText(title);
  await card.screenshot({ path: "generated-artifacts/inline-discovery-desktop.png" });
  await expect(result.locator(".expanded-evidence p").first()).not.toBeVisible();
  await result.locator(".expanded-evidence > summary").click();
  await expect(result.locator(".expanded-evidence p").first()).toBeVisible();
  await card.getByRole("button", { name: `Save ${title}`, exact: true }).click();
  await expect(card.getByRole("button", { name: `Remove ${title} from My Doors`, exact: true })).toBeVisible();
  await result.getByRole("button", { name: `Give feedback on ${title}`, exact: true }).click();
  await card.getByRole("button", { name: "Too expensive", exact: true }).click();
  await expect(card.locator(".feedback-panel")).toContainText("Noted: Too expensive");
  await result.getByRole("button", { name: "Explore more ideas", exact: true }).click();
  await expect(page.locator("#journey-result")).toContainText(title);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^My Doors/ }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("live requests exclude the local scenario while returned results and Lab retain it", async ({ page }) => {
  const brief = "Quiet and seated with a small budget, independently.";
  let sent: Record<string, unknown> | undefined;
  await page.route("**/api/status", async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), qlooConfigured: true } });
  });
  await page.route("**/api/agent/discover", async route => {
    sent = route.request().postDataJSON();
    const input = sent as { location: string; occasion: string; intent: string; depth: string; context: Record<string, string>; anchors: { label: string; category: string }[] };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "complete", journey: {
        mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
        context: input.context, anchors: input.anchors.map(anchor => anchor.label),
        categories: Object.fromEntries(input.anchors.map(anchor => [anchor.label, anchor.category])),
        iteration: 0, resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] },
        doors: [{ id: "mock-live-one", tier: "Familiar", title: "Test cultural discovery", kind: "Music",
          category: "Music", source: "Test fixture", why: "A returned cultural connection.", whyYou: "Based on your explicit cultural interest.",
          whyNow: "Preview a short excerpt.", evidence: "Mocked retrieval evidence for this browser test.",
          thread: "Listen closely", entityId: "fixture-entity", entityType: "artist" }],
      } }) + "\n",
    });
  });
  await page.goto("/demo");
  await page.getByRole("combobox", { name: "Personal considerations", exact: true }).selectOption("wellbeing");
  await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill(brief);
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator(".door-card h3")).toHaveText("Test cultural discovery");
  expect(JSON.stringify(sent)).not.toContain(brief);
  expect(JSON.stringify(sent)).not.toContain("scenario");
  await page.locator(".door-preview").click();
  await expect(page.locator(".scenario-result")).toContainText(brief);
  await page.getByRole("button", { name: "Branch in Discovery Lab" }).click();
  await expect(page.getByRole("textbox", { name: "Your scenario", exact: true })).toHaveValue(brief);
});

test("mobile keyboard opening is immediate, full-width, and keeps the visit count idempotent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  const first = page.locator(".door-preview").first();
  await first.focus();
  await page.keyboard.press("Enter");
  const result = page.locator(".door-card.is-expanded");
  await expect(result.locator(".door-result-expanded")).toBeVisible();
  await expect(result.locator("h4")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const opened = await page.evaluate(() => localStorage.getItem("opendoor.opened"));
  await page.keyboard.press("Escape");
  await expect(first).toBeFocused();
  await first.click();
  expect(await page.evaluate(() => localStorage.getItem("opendoor.opened"))).toBe(opened);
  await result.screenshot({ path: "generated-artifacts/inline-discovery-mobile.png" });
});
