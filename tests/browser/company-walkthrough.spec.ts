import { expect, test } from "@playwright/test";

test("featured hotel walkthrough leads to editable real company pages and a clearly separated roadmap", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.locator("#company-type")).toHaveValue("hospitality");
  await expect(page.locator(".company-hero-art img")).toHaveAttribute("src", /company-travel/);
  const walkthrough = page.locator("#company-walkthrough");
  await expect(walkthrough.getByRole("heading", { name: "A free afternoon before the show." })).toBeVisible();
  await expect(walkthrough.locator(".company-roadmap")).toContainText("Planned—not available yet");
  await expect(walkthrough.locator(".company-roadmap")).toContainText("MCP");
  await expect(walkthrough.locator(".company-roadmap")).toContainText("not available yet");
  await expect(walkthrough.getByRole("link", { name: /destination celebration example/ })).toHaveAttribute("href", "/companies/discover?type=celebrations");
  await expect(walkthrough.getByRole("link", { name: "Compare ideas in the Lab" })).toHaveAttribute("href", "/companies/lab?type=hospitality");
  await walkthrough.getByRole("link", { name: /Try hotel guest discovery/ }).click();
  await expect(page).toHaveURL(/\/companies\/discover\?type=hospitality/);
  await expect(page.locator("#city")).toHaveValue("New Orleans, Louisiana");
  await expect(page.locator("#occasion")).toHaveValue("A free afternoon before an evening show");
  await expect(page.locator(".anchor-pills")).toContainText("Nina Simone");
  await expect(page.locator(".anchor-pills")).toContainText("Amélie");
  await page.locator("#movement").fill("Short outings with frequent breaks");
  await expect(page.locator("#movement")).toHaveValue("Short outings with frequent breaks");
});

test("judge company walkthrough is shareable, mobile-readable and preserves the existing core walkthrough", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/judges#company-walkthrough");
  const guide = page.locator("#company-walkthrough");
  await expect(guide).toContainText("Nina Simone and Amélie");
  await expect(guide.locator("ol li")).toHaveCount(3);
  await expect(page.locator(".judge-step")).toHaveCount(6);
  await expect(guide).toContainText("planned—not available yet");
  await expect(page.locator(".app-header, .site-header").getByRole("link", { name: /Judge/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await guide.screenshot({ path: "generated-artifacts/company-judge-walkthrough-mobile.png" });
  await guide.getByRole("link", { name: /Try hotel guest discovery/ }).click();
  await expect(page).toHaveURL(/\/companies\/discover\?type=hospitality/);
});
