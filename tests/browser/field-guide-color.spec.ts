import { expect, test } from "@playwright/test";

test("colored result and saved-door guidance stays readable, controllable, and inside mobile bounds", async ({ page }) => {
  await page.goto("/demo");
  const firstDoor = page.locator(".door-card").first();
  const title = await firstDoor.locator("h3").innerText();
  const primary = firstDoor.locator(".primary-btn").first();
  const primaryColor = await primary.evaluate(element => getComputedStyle(element).backgroundColor);
  expect(primaryColor).toBe("rgb(169, 70, 54)");

  const resultGuide = page.locator(".result-guide");
  await expect(resultGuide).toBeVisible();
  const resultImage = resultGuide.locator("img");
  await expect(resultImage).toHaveJSProperty("naturalWidth", 480);
  await resultGuide.getByRole("button", { name: "Pause curiosity mascot animation" }).click();
  await expect(resultImage).toHaveAttribute("src", "/mascot/curiosity-guide-still.webp");
  await firstDoor.getByRole("button", { name: `Save ${title}`, exact: true }).click();
  await page.getByRole("button", { name: /^My Doors/ }).click();

  const savedGuide = page.locator(".saved-guide");
  await expect(savedGuide).toBeVisible();
  await expect(savedGuide.locator("img")).toHaveJSProperty("naturalWidth", 480);
  await expect(page.locator(".saved-row").first()).toContainText(title);
  const secondaryColor = await page.locator(".saved-row .secondary-btn").first().evaluate(element => getComputedStyle(element).backgroundColor);
  expect(secondaryColor).toBe("rgb(233, 243, 237)");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => savedGuide.locator("img").evaluate(image => (image as HTMLImageElement).currentSrc)).toContain("map-guide-still.webp");
  await expect(savedGuide.getByRole("button", { name: "Pause map mascot animation" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const outside = await page.locator("button:visible").evaluateAll(buttons => buttons.some(button => {
    const rect = button.getBoundingClientRect();
    return rect.left < 0 || rect.right > window.innerWidth + 1;
  }));
  expect(outside).toBe(false);
});
