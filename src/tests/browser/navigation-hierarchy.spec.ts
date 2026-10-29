import { expect, test, type Page } from "@playwright/test";

const experiences = ["Solo Discovery", "Taste Bridge", "What If? Explorer", "Discovery Debate"];
const personalHref = "/?explore=1";
const companyHref = "/?explore=1&audience=company#company-tools";
const personalNav = (page: Page) => page.getByRole("navigation", { name: "Personal discovery experiences", exact: true });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: false, sharedQlooConfigured: false, personalQlooConnected: false, demoAvailable: true,
  } }));
});

for (const route of ["/?explore=1", "/lab", "/companies/lab?type=hospitality"]) {
  test(`nested unique personal controls and exact parent destinations from ${route}`, async ({ page }) => {
    await page.goto(route);
    const avenues = page.getByRole("navigation", { name: "Ways to use Open Door", exact: true });
    await expect(avenues).toHaveCount(1);
    await expect(avenues).toContainText("One guide, two ways in");
    await expect(avenues.getByRole("link", { name: "01 — Explore for yourself", exact: true })).toHaveAttribute("href", personalHref);
    await expect(avenues.getByRole("link", { name: "02 — Help others explore", exact: true })).toHaveAttribute("href", companyHref);
    await expect(page.locator(".product-personal-path .experience-tabs")).toHaveCount(1);
    await expect(page.locator(".product-company-path .experience-tabs")).toHaveCount(0);
    await expect(page.locator(".experience-tabs")).toHaveCount(1);
    for (const name of experiences) {
      await expect(personalNav(page).getByRole(route.startsWith("/companies") ? "link" : "button", { name, exact: true })).toBeVisible();
      await expect(page.getByRole(route.startsWith("/companies") ? "link" : "button", { name, exact: true })).toHaveCount(1);
    }
    await avenues.getByRole("link", { name: "02 — Help others explore", exact: true }).click();
    await expect(page).toHaveURL(companyHref);
    await expect(personalNav(page).locator('[aria-current="page"]')).toHaveCount(0);
    await page.getByRole("link", { name: "01 — Explore for yourself", exact: true }).click();
    await expect(page).toHaveURL(personalHref);
  });
}

test("all four personal experiences switch in-app without losing mounted drafts", async ({ page }) => {
  await page.goto(personalHref);
  await page.locator("#city").fill("Portland, Maine");
  await personalNav(page).getByRole("button", { name: "Taste Bridge", exact: true }).click();
  await expect(page).toHaveURL("/?view=taste-bridge");
  await page.getByLabel("Person 1 name", { exact: true }).fill("Ruth");
  await personalNav(page).getByRole("button", { name: "What If? Explorer", exact: true }).click();
  await expect(page).toHaveURL("/?view=what-if");
  await expect(page.getByRole("heading", { name: "What If? Explorer", exact: true })).toBeVisible();
  await personalNav(page).getByRole("button", { name: "Discovery Debate", exact: true }).click();
  await expect(page).toHaveURL("/?view=debate");
  await expect(page.getByRole("heading", { name: "Discovery Debate", exact: true })).toBeVisible();
  await personalNav(page).getByRole("button", { name: "Taste Bridge", exact: true }).click();
  await expect(page.getByLabel("Person 1 name", { exact: true })).toHaveValue("Ruth");
  await personalNav(page).getByRole("button", { name: "Solo Discovery", exact: true }).click();
  await expect(page).toHaveURL(personalHref);
  await expect(page.locator("#city")).toHaveValue("Portland, Maine");
  await expect(personalNav(page).locator('[aria-current="page"]')).toHaveCount(1);
});

for (const [name, route] of [
  ["Solo Discovery", personalHref], ["Taste Bridge", "/?view=taste-bridge"],
  ["What If? Explorer", "/?view=what-if"], ["Discovery Debate", "/?view=debate"],
]) {
  test(`company query clears when choosing ${name}`, async ({ page }) => {
    await page.goto(companyHref);
    await expect(page.locator(".product-company-path > a")).toHaveAttribute("aria-current", "page");
    await expect(personalNav(page).locator('[aria-current="page"]')).toHaveCount(0);
    await personalNav(page).getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(route);
    await expect(page.locator(".product-personal-path > a")).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".product-company-path > a")).not.toHaveAttribute("aria-current");
    await expect(personalNav(page).getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.locator(".product-personal-path > a")).toHaveAttribute("aria-current", "page");
  });
}

test("company-profile children leave the company scope, while Lab remains available", async ({ page }) => {
  await page.goto("/companies/lab?type=hospitality");
  await expect(page.locator(".product-company-path > a")).toHaveAttribute("aria-current", "page");
  await expect(personalNav(page).locator('[aria-current="page"]')).toHaveCount(0);
  await personalNav(page).getByRole("link", { name: "Taste Bridge", exact: true }).click();
  await expect(page).toHaveURL("/?view=taste-bridge");
  await expect(page.locator(".company-banner")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("button", { name: "Discovery Lab", exact: true }).click();
  await expect(page).toHaveURL("/lab");
  await expect(page.locator(".discovery-lab")).toBeVisible();
});

test("mobile hierarchy and every personal experience stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(personalHref);
  for (const name of experiences) {
    await personalNav(page).getByRole("button", { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const personal = await page.locator(".product-personal-path").boundingBox();
    const company = await page.locator(".product-company-path").boundingBox();
    expect(personal).not.toBeNull();
    expect(company!.y).toBeGreaterThanOrEqual(personal!.y + personal!.height);
  }
});
