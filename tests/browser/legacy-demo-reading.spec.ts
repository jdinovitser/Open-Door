import { expect, test } from "@playwright/test";

test("returning to an older demo replaces recursive exercise copy after the welcome door", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("opendoor.journey", JSON.stringify({
      city: "Brooklyn, New York", occasion: "A free Saturday", intent: "Try something new",
      anchors: ["A shared noticing exercise · step 4"], categories: {}, iteration: 4, depth: "Surprise me", mode: "demo",
      context: { time: "A free Saturday", budget: "Flexible", movement: "Mostly seated", conditions: "Open to anything", scenario: "I love music and art", scenarioCategory: "custom" },
      doors: [{ id: "old-demo", tier: "Familiar", title: "A story-detail notebook · step 5", kind: "Books · guided sample exercise",
        category: "Books", why: "This authored continuation follows the previous activity.", now: "Use a shared noticing exercise." }],
    }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open the illustrated door", exact: true }).click();
  await expect(page.locator(".door-card h3").first()).toHaveText("Make a three-song playlist", { timeout: 15000 });
  await page.locator(".door-preview").first().click();
  await expect(page.locator(".door-card.is-expanded")).not.toContainText("guided sample exercise");
  await expect(page.locator(".door-card.is-expanded")).toContainText("music and art");
});
