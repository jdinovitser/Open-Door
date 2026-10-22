import { expect, test } from "@playwright/test";

const illustrations = [
  ["business", "company-business"],
  ["real-estate", "company-real-estate"],
  ["hospitality", "company-travel"],
  ["celebrations", "company-destination"],
] as const;

test("company preset selection immediately displays the matching supplied illustration", async ({ page }) => {
  await page.goto("/companies");
  for (const [type, asset] of illustrations) {
    await page.locator("#company-type").selectOption(type);
    const artwork = page.locator(".company-hero-art .mascot-visual img");
    await expect(artwork).toHaveAttribute("src", `/mascot/${asset}.webp`);
    await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
    await page.locator(".company-hero-art").getByRole("button", { name: /Pause .* mascot animation/ }).click();
    await expect(artwork).toHaveAttribute("src", `/mascot/${asset}-still.webp`);
  }
  await page.locator("#company-type").selectOption("other");
  await expect(page.locator(".company-hero-art img")).toHaveAttribute("src", /explorer-guide/);
});

test("each company Discovery and Lab uses its matching artwork without changing individual art", async ({ page }) => {
  for (const [type, asset] of illustrations) {
    await page.goto(`/companies/discover?type=${type}`);
    const discoveryArt = page.locator(".hero-art .mascot-visual img");
    await discoveryArt.scrollIntoViewIfNeeded();
    await expect(discoveryArt).toHaveAttribute("src", `/mascot/${asset}.webp`);
    await page.goto(`/companies/lab?type=${type}`);
    const labArt = page.locator(".lab-welcome-guide .mascot-visual img");
    await labArt.scrollIntoViewIfNeeded();
    await expect(labArt).toHaveAttribute("src", `/mascot/${asset}.webp`);
  }
  await page.goto("/lab");
  await expect(page.locator(".lab-welcome-guide img")).toHaveAttribute("src", /coffee-guide/);
});

test("company art respects reduced motion and fits a phone screen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies");
  await page.locator("#company-type").selectOption("business");
  const artwork = page.locator(".company-hero-art img");
  await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain("company-business-still.webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "generated-artifacts/company-mascot-mobile.png", fullPage: true });
});
