import { expect, test } from "@playwright/test";

for (const path of ["/?explore=1&audience=company#company-tools", "/lab?audience=company#company-tools"]) {
  test(`Help others explore has readable Try discovery text on ${path}`, async ({ page }) => {
    await page.goto(path);
    const link = page.locator("#company-tools").getByRole("link", { name: /^Try discovery/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS("color", "rgb(23, 62, 51)");
    await expect(link).toHaveCSS("background-color", "rgb(224, 237, 228)");
    await link.hover();
    await expect(link).toHaveCSS("color", "rgb(23, 62, 51)");
    await expect(link).toHaveCSS("background-color", "rgb(203, 222, 208)");
    await page.setViewportSize({ width: 390, height: 844 });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS("color", "rgb(23, 62, 51)");
  });
}
