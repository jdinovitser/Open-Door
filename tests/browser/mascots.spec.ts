import { expect, test } from "@playwright/test";

test("welcome mascot loads unobstructed and settles without illustration buttons", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the illustrated door" }).click();
  await page.getByRole("button", { name: "Skip animation", exact: true }).click();
  const guide = page.locator(".hero-welcome-art");
  const image = guide.locator("img");
  await expect(image).toHaveAttribute("src", /door-mascot-appear\.webp\?play=/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".mascot-motion-toggle")).toHaveCount(0);
  await expect(guide).toHaveAttribute("data-art-phase", "complete", { timeout: 5000 });
  await expect(image).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
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
  await expect(page.locator(".mascot-motion-toggle")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator("details.friendly-connection > summary").first().click();
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await page.getByLabel("Cultural interest", { exact: true }).fill("jazz");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect(page.locator(".lab-edit-plan")).toBeVisible();
});
