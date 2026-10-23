import { expect, test } from "@playwright/test";

const examples = [
  { tab: "Destination weddings", type: "celebrations", names: ["YOUR Dining", "YOUR Hotel", "YOUR Photography", "YOUR Hair Salon", "YOUR Makeup Artist", "YOUR Limo"], link: "Try the wedding discovery example" },
  { tab: "Real estate & neighbors", type: "real-estate", names: ["YOUR Bed and Breakfast", "YOUR Dining", "YOUR Art Club", "YOUR Skating Rink"], link: "Try the neighborhood discovery example" },
  { tab: "Hotels & venues", type: "hospitality", names: ["YOUR Hotel", "YOUR Dining", "YOUR Venue"], link: "Try the hotel discovery example" },
];

for (const example of examples) {
  test(`${example.tab} shows its complete, clearly fictional sponsored preview and working links`, async ({ page }) => {
    await page.goto("/mockups");
    const section = page.locator("#partner-mockups");
    await section.getByRole("tab", { name: example.tab, exact: true }).click();
    const panel = section.getByRole("tabpanel", { name: example.tab, exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-sponsor]")).toHaveCount(example.names.length);
    for (const name of example.names) {
      const card = panel.locator(`[data-sponsor="${name}"]`);
      await expect(card).toBeVisible();
      await expect(card).toContainText("Sponsored · mockup");
    }
    await expect(panel).toContainText("No Qloo results are shown in this mockup");
    await expect(section.getByRole("link", { name: example.link, exact: false })).toHaveAttribute("href", `/?explore=1&audience=company&type=${example.type}#company-tools`);
    await section.getByRole("link", { name: "Discuss this partnership", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/contact\\?type=${example.type}&inquiry=partnership#inquiry`));
    const form = page.locator(".company-inquiry-form");
    await expect(form.getByLabel(/Company use case/)).toHaveValue(example.type);
    await expect(form.locator("textarea")).toHaveValue(/^Partnership inquiry:/);
    await expect(page.locator("#company-inquiry-title")).toBeInViewport();
    await expect(form.getByRole("checkbox")).not.toBeChecked();
  });
}

test("mockup tabs support arrow keys, Home, End and proper selected-panel labels", async ({ page }) => {
  await page.goto("/mockups#partner-mockups");
  const section = page.locator("#partner-mockups");
  await expect(section.getByRole("tab")).toHaveText(examples.map(example => example.tab));
  const firstTab = section.getByRole("tab", { name: examples[0].tab, exact: true });
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
  await firstTab.focus();
  await firstTab.press("ArrowRight");
  await expect(section.getByRole("tab", { name: examples[1].tab, exact: true })).toBeFocused();
  await expect(section.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "partner-tab-neighborhoods");
  await page.keyboard.press("End");
  await expect(section.getByRole("tab", { name: examples[2].tab, exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(firstTab).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
});

test("all previews fit mobile and the discovery action opens the real editable guest flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mockups");
  const section = page.locator("#partner-mockups");
  for (const example of examples) {
    await section.getByRole("tab", { name: example.tab, exact: true }).click();
    await expect(section.getByRole("tabpanel")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await section.getByRole("tab", { name: "Destination weddings", exact: true }).click();
  await section.getByRole("link", { name: "Try the wedding discovery example", exact: false }).click();
  await expect(page).toHaveURL(/\/\?explore=1&audience=company&type=celebrations#company-tools$/);
  await expect(page.locator("#company-tools")).toHaveAttribute("open");
  await expect(page.locator("#company-tools-type")).toHaveValue("celebrations");
  await expect(page.getByLabel("Place you’re exploring", { exact: true })).toBeVisible();
});

for (const example of examples) {
  test(`${example.tab}: every partner selection highlights an illustrated guest-facing placement`, async ({ page }) => {
    await page.goto("/mockups");
    const section = page.locator("#partner-mockups");
    await section.getByRole("tab", { name: example.tab, exact: true }).click();
    const panel = section.getByRole("tabpanel");
    const featured = panel.getByRole("region", { name: "Guest-facing partner preview", exact: true });
    for (const name of example.names) {
      const card = panel.locator(`[data-sponsor="${name}"]`);
      await card.getByRole("button").click();
      await expect(card.getByRole("button")).toHaveAttribute("aria-pressed", "true");
      await expect(panel.locator('[data-sponsor] button[aria-pressed="true"]')).toHaveCount(1);
      await expect(featured.getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(featured).toContainText(/Sponsored/i);
      const image = featured.getByRole("img");
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveAttribute("src", /^\/partner-previews\/.+\.webp$/);
    }
    await featured.getByRole("button", { name: "See partner details", exact: true }).click();
    await expect(featured).toContainText(/no business is linked/i);
    await featured.getByRole("button", { name: "Hide partner details", exact: true }).click();
    await expect(featured.getByRole("button", { name: "See partner details", exact: true })).toHaveAttribute("aria-expanded", "false");
  });
}
