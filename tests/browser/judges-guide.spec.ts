import { expect, test } from "@playwright/test";

test("footer links directly to the downloadable four-page judge PDF", async ({ page, request }) => {
  await page.goto("/judges");
  const pdfLink = page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Judge’s Guide (PDF)", exact: true });
  await expect(pdfLink).toHaveAttribute("href", "/Open-Door-Judges-Guide.pdf");
  await expect(pdfLink).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Judge’s Guide (PDF)", exact: true })).toHaveCount(0);
  const response = await request.get("/Open-Door-Judges-Guide.pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.goto("/partners");
  await expect(page.locator("footer").getByRole("link", { name: "Judge’s Guide (PDF)", exact: true })).toHaveAttribute("href", "/Open-Door-Judges-Guide.pdf");
});

test("direct judge URL survives reload and is linked only from the footer navigation", async ({ page }) => {
  await page.goto("/judges");
  await expect(page.getByRole("heading", { name: "Judge’s Guide", exact: true })).toBeVisible();
  await expect(page).toHaveTitle("Judge’s Guide | Open Door");
  await expect(page.locator(".judge-steps > li")).toHaveCount(6);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByText("Judge’s Guide")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button")).toHaveCount(5);
  await expect(page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Judge’s Guide" })).toHaveAttribute("href", "/judges");
  await expect(page.getByRole("link", { name: "Open app in a new tab" })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("region", { name: "Qloo configuration status" })).toContainText(/not proof|not a completed retrieval|require a configured server/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Judge’s Guide", exact: true })).toBeVisible();
});

test("footer link opens the guide and its copy action copies the actual route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Judge’s Guide" }).click();
  await expect(page).toHaveURL(/\/judges$/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => { document.documentElement.dataset.copiedGuide = value; },
    } });
  });
  await page.getByRole("button", { name: "Copy this guide’s link" }).click();
  await expect(page.locator(".judge-copy-status")).toHaveText("Guide link copied.");
  await expect(page.locator("html")).toHaveAttribute("data-copied-guide", /\/judges$/);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Discover", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Open the door", exact: true })).toBeVisible();
});

test("mobile guide has no horizontal overflow and clipboard failures are disclosed", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/judges/");
  await expect(page.getByRole("heading", { name: "Judge’s Guide", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new Error("Permission denied"); },
    } });
  });
  await page.getByRole("button", { name: "Copy this guide’s link" }).click();
  await expect(page.locator(".judge-copy-status")).toContainText("could not be copied");
});
