import { expect, test } from "@playwright/test";

test("the business model explains company funding, Qloo grounding and planned commercial features", async ({ page }) => {
  await page.goto("/partners");
  await expect(page).toHaveTitle("Partnerships & Business Model | Open Door");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Free for explorers");
  await expect(page.locator(".partnerships-hero-note")).toContainText("Planned revenue is company-funded");
  await expect(page.locator(".partnerships-model")).toContainText("Qloo");
  await expect(page.getByRole("heading", { name: "Branded guest experiences", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clearly labeled sponsorship", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agreed referral arrangements", exact: true })).toBeVisible();
  await expect(page.locator(".partnerships-state.is-live")).toContainText("WORKING TODAY");
  await expect(page.locator(".partnerships-state.is-planned")).toContainText("PLANNED COMMERCIAL FEATURES");
  await expect(page.locator(".partnerships-trust")).toContainText("UTM");
  await expect(page.locator(".partnerships-trust")).toContainText("Payment will never be presented as evidence of cultural relevance");
  await page.getByRole("link", { name: "Explore for free" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your way");
});

for (const topic of ["partnership", "investment"] as const) {
  test(`${topic} inquiry is editable, requires consent and submits through the existing saved-receipt flow`, async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route("**/api/company/inquiries", route => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      return route.fulfill({ status: 201, json: { id: body.requestId, submittedAt: new Date().toISOString() } });
    });
    await page.goto("/partners");
    await page.getByRole("link", { name: topic === "partnership" ? "Discuss a partnership" : "Investor conversation", exact: true }).first().click();
    const heading = page.locator("#company-inquiry-title");
    await expect(heading).toHaveText(topic === "partnership" ? "Let’s explore a partnership." : "Let’s talk about Open Door’s future.");
    await expect(heading).toBeInViewport();
    const form = page.locator(".company-inquiry-form");
    const details = form.locator("textarea");
    await expect(details).toHaveValue(topic === "partnership" ? /^Partnership inquiry:/ : /^Investment conversation:/);
    if (topic === "investment") {
      await expect(form.getByLabel(/Explain the use case/)).toHaveValue("Investment conversation about Open Door");
    }
    await form.getByLabel(topic === "partnership" ? /Company or organization/ : /Company, fund or independent investor/).fill("Example Partner");
    await form.getByLabel(/Your name/).fill("Test Contact");
    await form.getByLabel(topic === "partnership" ? /Work email/ : /^Email/).fill("contact@example.test");
    await details.fill(`${await details.inputValue()} We would like to discuss a pilot for our audience.`);
    await expect(form.getByRole("checkbox")).not.toBeChecked();
    const send = form.getByRole("button", { name: /Send inquiry/ });
    if (await send.isEnabled()) await send.click();
    expect(bodies).toHaveLength(0);
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: /Send inquiry/ }).click();
    await expect(page.locator(".company-success")).toContainText("Reference");
    expect(bodies).toHaveLength(1);
    expect(bodies[0].consent).toBe(true);
    expect(bodies[0].details).toMatch(topic === "partnership" ? /^Partnership inquiry:/ : /^Investment conversation:/);
  });
}

test("partnerships is findable from the footer, company portal and Judge’s Guide", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Footer navigation", exact: true }).getByRole("link", { name: "Partnerships & business model" })).toHaveAttribute("href", "/partners");
  await page.goto("/companies");
  await page.getByRole("navigation", { name: "Company page sections", exact: true }).getByRole("link", { name: "Partnerships & business model" }).click();
  await expect(page).toHaveURL(/\/partners$/);
  await page.goto("/judges");
  await page.getByRole("link", { name: "Read the partnership and investor story." }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Free for explorers");
});

test("mobile partner navigation and inquiry remain within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/partners");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Discuss a partnership", exact: true }).first().click();
  await expect(page.locator("#company-inquiry-title")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
