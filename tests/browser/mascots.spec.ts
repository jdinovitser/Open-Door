import { expect, test } from "@playwright/test";

test("welcome mascot animates, can be paused and resumed, and loads without broken images", async ({ page }) => {
  await page.goto("/");
  const guide = page.locator(".entry-companion [data-mascot-scene='map']");
  const image = guide.locator("img");
  await expect(image).toHaveAttribute("src", "/mascot/map-guide.webp");
  await expect(image).toHaveJSProperty("naturalWidth", 480);
  await guide.getByRole("button", { name: "Pause map mascot animation" }).click();
  await expect(image).toHaveAttribute("src", "/mascot/map-guide-still.webp");
  await expect(guide.getByRole("button", { name: "Play map mascot animation" })).toHaveAttribute("aria-pressed", "true");
  await guide.getByRole("button", { name: "Play map mascot animation" }).click();
  await expect(image).toHaveAttribute("src", "/mascot/map-guide.webp");
});

test("mascots appear across Lab, saved doors and the cultural gallery; offscreen animation stops", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.locator("[data-mascot-scene='coffee'] img")).toHaveJSProperty("naturalWidth", 480);
  await page.getByRole("button", { name: "My Doors", exact: true }).click();
  await expect(page.locator("[data-mascot-scene='hello'] img")).toHaveJSProperty("naturalWidth", 480);
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  await expect(page.locator("[data-mascot-scene='explorer']")).toBeVisible();
  const gallery = page.locator(".mascot-showcase");
  await expect(gallery.locator("figure")).toHaveCount(4);
  const music = gallery.locator("[data-mascot-scene='music'] img");
  await music.scrollIntoViewIfNeeded();
  await expect(music).toHaveAttribute("src", "/mascot/music-guide.webp");
  for (const scene of ["music", "artist", "camera", "curiosity"]) {
    const image = gallery.locator(`[data-mascot-scene='${scene}'] img`);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("naturalWidth", 480);
  }
  await gallery.screenshot({ path: "generated-artifacts/mascot-gallery.png" });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(music).not.toBeInViewport();
  await expect(music).toHaveAttribute("src", "/mascot/music-guide-still.webp");
});

test("reduced motion uses still artwork and the mobile Lab stays usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/lab");
  const guide = page.locator("[data-mascot-scene='coffee']");
  await guide.scrollIntoViewIfNeeded();
  await expect.poll(() => guide.locator("img").evaluate(image => (image as HTMLImageElement).currentSrc)).toContain("coffee-guide-still.webp");
  await expect(guide.getByRole("button", { name: "Pause coffee mascot animation" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByLabel("Cultural interest", { exact: true }).fill("jazz");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The starting point", exact: true })).toBeVisible();
});
