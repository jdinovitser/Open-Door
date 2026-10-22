import { expect, test, type Page } from "@playwright/test";

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main navigation", exact: true });

test("one identity and two avenues connect the individual, organizer and guest experiences", async ({ page }) => {
  await page.goto("/");
  const avenues = page.getByRole("navigation", { name: "Ways to use Open Door" });
  await expect(avenues.getByRole("link", { name: "Explore for yourself" })).toBeVisible();
  await avenues.getByRole("link", { name: "Help others explore" }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.locator(".brand-caption")).toHaveText("cultural discovery with Qloo");
  for (const label of ["Discover", "Discovery Lab", "My Doors", "How it works", "Trust", "For companies"]) {
    await expect(mainNav(page).getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: /^Try discovery/ }).click();
  await expect(mainNav(page).getByRole("button", { name: "Discover", exact: true })).toBeVisible();
  await expect(page.locator(".company-banner")).toContainText("Your occasion");
  await expect(page.locator(".company-banner")).toContainText("A free afternoon before an evening show");
  await expect(page.locator(".brand-caption")).toHaveText("cultural discovery with Qloo");
});

test("organizers share public context; visitor edits persist across Discover, Lab, sign-in return and reload", async ({ page }) => {
  await page.goto("/companies");
  await page.locator("#company-public-place").fill("Boston");
  await page.locator("#company-public-occasion").fill("Before our welcome dinner");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async (value: string) => { document.documentElement.dataset.guestLink = value; },
  } }));
  await page.getByRole("button", { name: "Copy guest link", exact: true }).click();
  const link = await page.locator("html").getAttribute("data-guest-link");
  expect(link).toBeTruthy();
  expect([...new URL(link!).searchParams.keys()]).toEqual(["type", "place", "occasion"]);
  await page.goto(link!);
  await expect(page.locator("#city")).toHaveValue("Boston");
  await expect(page.locator("#occasion")).toHaveValue("Before our welcome dinner");
  await page.locator("#occasion").fill("Lunch before the show");
  await page.locator("#budget").fill("Under $40");
  await page.locator("textarea").first().fill("PRIVATE: I need quiet options and seated breaks.");
  await mainNav(page).getByRole("button", { name: "Discovery Lab", exact: true }).click();
  await expect(page.locator("#lab-location")).toHaveValue("Boston");
  await expect(page.locator(".discovery-lab textarea").first()).toHaveValue(/PRIVATE/);
  await expect(page.locator(".company-banner")).toContainText("Lunch before the show");
  await page.locator("#lab-location").fill("Cambridge");
  await mainNav(page).getByRole("button", { name: "Discover", exact: true }).click();
  await expect(page.locator("#city")).toHaveValue("Cambridge");
  await expect(page.locator("#budget")).toHaveValue("Under $40");
  await expect(page.locator("#occasion")).toHaveValue("Lunch before the show");
  await page.reload();
  await expect(page.locator("#city")).toHaveValue("Cambridge");
  await expect(page.locator("#occasion")).toHaveValue("Lunch before the show");
  expect(page.url()).not.toContain("PRIVATE");
  expect(page.url()).not.toContain("Under");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
  await page.getByRole("link", { name: "Continue as guest", exact: true }).click();
  await expect(page).toHaveURL(/\/companies\/discover/);
  await expect(page.locator("#city")).toHaveValue("Cambridge");
  await page.locator(".company-banner").getByRole("button", { name: "Change occasion", exact: true }).click();
  await expect(page.locator("#occasion")).toBeFocused();
});

test("saved doors belong to the same person across both avenues, and leaving an occasion is explicit", async ({ page }) => {
  await page.goto("/demo");
  const first = page.locator(".door-card").first();
  await expect(first).toBeVisible();
  const title = await first.locator("h3").innerText();
  await first.getByRole("button", { name: `Save ${title}`, exact: true }).click();
  await page.goto("/companies/discover?type=celebrations");
  await mainNav(page).getByRole("button", { name: /^My Doors/ }).click();
  await expect(page.locator(".saved-row").first()).toContainText(title);
  await expect(page.locator(".company-banner")).toContainText("An afternoon around a celebration");
  await page.locator(".company-banner").getByRole("link", { name: "Explore on my own", exact: true }).click();
  await expect(page.locator(".company-banner")).toHaveCount(0);
  await mainNav(page).getByRole("button", { name: /^My Doors/ }).click();
  await expect(page.locator(".saved-row").first()).toContainText(title);
  expect(page.url()).not.toContain("/companies");
});

test("mobile organizer and visitor navigation stays within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("link", { name: /^Try discovery/ }).click();
  await mainNav(page).getByRole("button", { name: "Discovery Lab", exact: true }).click();
  await expect(page.locator(".company-banner")).toContainText("Your occasion");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "generated-artifacts/unified-company-mobile.png", fullPage: true });
});
