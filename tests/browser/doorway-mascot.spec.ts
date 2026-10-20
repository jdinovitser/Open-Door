import { expect, test } from "@playwright/test";

test("the intro door is keyboard and pointer accessible and plays the supplied artwork once", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const closedDoor = page.getByRole("button", { name: "Open the illustrated door" });
    await expect(closedDoor).toBeVisible();
    const closedStyle = await page.locator(".entry-frame").evaluate(frame => {
      const style = getComputedStyle(frame);
      return { border: style.borderTopColor, radius: style.borderTopLeftRadius };
    });
    expect(closedStyle.border).toBe("rgb(153, 75, 64)");
    expect(parseFloat(closedStyle.radius)).toBeGreaterThan(40);

    if (viewport.width === 1280) {
      await closedDoor.focus();
      await page.keyboard.press("Enter");
    } else {
      await closedDoor.click();
    }
    await expect(page.locator(".entry-scene")).toHaveAttribute("data-entry-phase", "opening");
    await expect(page.locator(".entry-scene .entry-frame")).toBeVisible();
    await expect(page.getByTestId("doorway-animation-image")).toHaveCount(0);
    await expect(page.locator(".entry-scene .entry-leaf")).toHaveCSS("transition-duration", "1.05s");
    await expect(page.locator(".entry-scene")).toHaveAttribute("data-entry-phase", "welcoming", { timeout: 2000 });
    const animatedImage = page.getByTestId("doorway-animation-image");
    await expect(animatedImage).toHaveAttribute("src", /welcome-opening\.webp\?play=0/);
    await expect(animatedImage).toHaveJSProperty("naturalWidth", 480);

    await page.getByRole("button", { name: "Pause welcome illustration" }).click();
    await expect(animatedImage).toHaveAttribute("src", "/mascot/welcome-opening-still.webp");
    await page.getByRole("button", { name: "Play welcome illustration" }).click();
    await expect(animatedImage).toHaveAttribute("src", /welcome-opening\.webp\?play=1/);

    const enteredArt = page.locator(".hero-welcome-art");
    await expect(enteredArt).toBeVisible({ timeout: 4000 });
    await expect(page.locator(".entry-scene")).toHaveCount(0);
    await expect(enteredArt.locator("img")).toHaveAttribute("src", "/mascot/welcome-opening-still.webp");
    await expect(enteredArt.locator(".mascot-motion-toggle")).toBeVisible();
  }
});

test("prepared-sample flow retains red arched previews, reveal artwork, close, Escape and focus return", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the prepared sample door" }).click();
  await expect(page.getByTestId("doorway-animation-image")).toHaveAttribute("src", /welcome-opening\.webp/);
  await expect(page.locator("#journey-result")).toBeVisible({ timeout: 5000 });

  const preview = page.locator(".door-preview").first();
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const previewStyle = await preview.locator(".preview-opening").evaluate(door => {
      const style = getComputedStyle(door);
      return { border: style.borderTopColor, radius: style.borderTopLeftRadius };
    });
    expect(previewStyle.border).toBe("rgb(169, 81, 69)");
    expect(parseFloat(previewStyle.radius)).toBeGreaterThan(40);
  }

  await preview.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".reveal-swing-art")).toBeVisible();
  await expect(dialog.locator(".reveal-swing-art .entry-leaf")).toHaveCSS("animation-name", "welcome-door-swing");
  await expect(dialog.getByTestId("doorway-animation-image")).toHaveJSProperty("naturalWidth", 480);
  await expect(dialog.getByTestId("doorway-animation-image")).toHaveAttribute("src", /welcome-opening\.webp/);
  await expect(dialog.locator(".reveal-content")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close this door" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(preview).toBeFocused();
});

test("reduced motion uses the supplied still pose and the mobile layout remains inside the viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open the illustrated door" }).click();

  const enteredArt = page.locator(".hero-welcome-art");
  await expect(enteredArt).toBeVisible({ timeout: 1500 });
  await expect(enteredArt.locator("img")).toHaveAttribute("src", "/mascot/welcome-opening-still.webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Open the sample journey" }).click();
  await expect(page.locator("#journey-result")).toBeVisible({ timeout: 3000 });
  await page.locator(".door-preview").first().click();
  await expect(page.getByRole("dialog").getByTestId("doorway-animation-image"))
    .toHaveAttribute("src", "/mascot/welcome-opening-still.webp");
});
