import { expect, test } from "@playwright/test";

test("entry plays the supplied opening then mascot artwork on desktop and mobile", async ({ page }) => {
  test.setTimeout(45000);
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const entry = page.getByTestId("entry-art");
    const image = entry.getByTestId("doorway-animation-image");
    await expect(image).toHaveAttribute("src", "/mascot/door-closed.webp");
    const trigger = page.getByRole("button", { name: "Open the illustrated door" });
    if (viewport.width === 1280) {
      await trigger.focus();
      await page.keyboard.press("Enter");
    } else await trigger.click();
    await expect(image).toHaveAttribute("src", /door-opening\.webp\?play=/);
    await expect(entry.getByTestId("doorway-animation")).toHaveAttribute("data-art-phase", "opening");
    await expect(image).toHaveAttribute("src", /door-mascot-appear\.webp\?play=/, { timeout: 5000 });
    await expect(entry.getByTestId("doorway-animation")).toHaveAttribute("data-art-phase", "mascot");
    const hero = page.locator(".hero-welcome-art");
    await expect(hero).toBeVisible({ timeout: 5000 });
    await expect(hero.locator("img")).toHaveAttribute("src", /door-mascot-appear\.webp\?play=/);
    await page.getByRole("button", { name: "Pause illustration", exact: true }).click();
    await expect(hero.locator("img")).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
    await page.getByRole("button", { name: "Play illustration", exact: true }).click();
    await expect(hero.locator("img")).toHaveAttribute("src", /door-mascot-appear\.webp\?play=/);
    await expect(hero).toHaveAttribute("data-art-phase", "complete", { timeout: 5000 });
    await expect(hero.locator("img")).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await hero.screenshot({ path: `generated-artifacts/supplied-door-hero-${viewport.width}.png` });
  }
});

test("cards reveal results immediately while playing both GIFs, hold the mascot and restart on reopen", async ({ page }) => {
  await page.goto("/demo");
  const preview = page.locator(".door-preview").first();
  const image = preview.getByTestId("doorway-animation-image");
  const artwork = preview.getByTestId("doorway-animation");
  await expect(image).toHaveAttribute("src", "/mascot/door-closed.webp");
  await preview.click();
  const result = page.locator(".door-card.is-expanded .door-result-expanded");
  await expect(result).toBeVisible({ timeout: 1000 });
  await expect(result.locator("h4")).toBeFocused();
  await expect(image).toHaveAttribute("src", /door-opening\.webp\?play=/);
  const firstRun = await image.getAttribute("src");
  await expect(image).toHaveAttribute("src", /door-mascot-appear\.webp\?play=/, { timeout: 5000 });
  await expect(artwork).toHaveAttribute("data-art-phase", "complete", { timeout: 5000 });
  await expect(image).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.screenshot({ path: "generated-artifacts/supplied-door-card-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(result).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(image).toHaveAttribute("src", "/mascot/door-closed.webp");
  await preview.click();
  await expect(image).toHaveAttribute("src", /door-opening\.webp\?play=/);
  expect(await image.getAttribute("src")).not.toBe(firstRun);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".door-reveal,.hallway-phase")).toHaveCount(0);
});

test("reduced motion uses supplied stills, bypasses waits and has no animated door requests", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 402, height: 874 });
  const animatedRequests: string[] = [];
  page.on("request", request => {
    if (/\/mascot\/door-(closed|opening|mascot-appear)\.webp/.test(request.url())) animatedRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByTestId("entry-art").locator("img")).toHaveAttribute("src", "/mascot/door-closed-still.webp");
  await page.getByRole("button", { name: "Open the illustrated door" }).click();
  const hero = page.locator(".hero-welcome-art");
  await expect(hero).toBeVisible({ timeout: 1500 });
  await expect(hero.locator("img")).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await page.getByRole("button", { name: "Open the sample journey" }).click();
  await page.locator(".door-preview").first().click();
  await expect(page.locator(".door-card.is-expanded .door-result-expanded")).toBeVisible();
  await expect(page.locator(".door-card.is-expanded .door-preview img")).toHaveAttribute("src", "/mascot/door-mascot-appear-still.webp");
  expect(animatedRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("entry animation can be skipped without losing the prepared sample or adding clicks to results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the prepared sample door" }).click();
  await page.getByRole("button", { name: "Skip animation", exact: true }).click();
  await expect(page.locator("#journey-result")).toBeVisible({ timeout: 2000 });
  await expect(page.locator(".door-card")).toHaveCount(3);
});
