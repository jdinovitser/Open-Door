import { expect, test } from "@playwright/test";

test("commercial pages are separate, clearly named and exclude the active guest tools", async ({ page }) => {
  for (const [path, title] of [
    ["/partners", "Business Model and Partnerships"],
    ["/contact", "Talk to us"],
    ["/mockups", "Partnership mockups"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(title));
    const main = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(main.getByRole("link", { name: "Business Model and Partnerships", exact: true })).toHaveAttribute("href", "/partners");
    await expect(page.locator("#company-tools")).toHaveCount(0);
    await expect(page.locator("#company-walkthrough")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Ways to use Open Door", exact: true })).toHaveCount(0);
    await expect(page.locator('a[aria-current="page"][href="' + path + '"]').last()).toBeVisible();
  }
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.goto("/contact");
  await expect(page.locator(".company-inquiry-form")).toBeVisible();
  await expect(page.locator("#partner-mockups")).toHaveCount(0);
});

test("Discover hosts the company presets, guest walkthrough and privacy-safe sharing", async ({ page }) => {
  let copied = "";
  let requests = 0;
  await page.exposeFunction("captureGuestLink", (text: string) => { copied = text; });
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { writeText: (text: string) => (window as any).captureGuestLink(text) },
  }));
  await page.route("**/api/agent/discover", route => { requests++; return route.abort(); });
  await page.goto("/?explore=1");
  await page.getByRole("link", { name: /Help others explore/ }).click();
  await expect(page).toHaveURL(/audience=company#company-tools/);
  const tools = page.locator("#company-tools");
  await expect(tools).toHaveAttribute("open");
  await tools.locator("select").selectOption("real-estate");
  await tools.locator('input[type="text"], input:not([type])').nth(0).fill("Brooklyn");
  await tools.locator('input[type="text"], input:not([type])').nth(1).fill("A neighborhood visit");
  await tools.locator('input[type="text"], input:not([type])').nth(1).press("Enter");
  await tools.getByRole("button", { name: /Copy guest link/i }).click();
  expect(requests).toBe(0);
  const link = new URL(copied);
  expect(link.pathname).toBe("/companies/discover");
  expect([...link.searchParams.keys()].sort()).toEqual(["occasion", "place", "type"]);
  expect(link.searchParams.get("type")).toBe("real-estate");
  expect(link.searchParams.get("place")).toBe("Brooklyn");
  await tools.getByText(/^Guest walkthrough · how the experience works$/).click();
  await expect(tools.locator("#company-walkthrough")).toBeVisible();
  await tools.locator('a[href^="/companies/discover?"]').first().click();
  await expect(page.getByLabel("Place you’re exploring", { exact: true })).toHaveValue("Brooklyn");
  await expect(page.getByLabel("Time and occasion", { exact: true })).toHaveValue("A neighborhood visit");
});

test("Lab offers company examples inside the ordinary exploration workflow", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("link", { name: /Help others explore/ }).click();
  await expect(page).toHaveURL(/\/lab\?audience=company#company-tools$/);
  const tools = page.locator("#company-tools");
  await expect(tools).toHaveAttribute("open");
  await tools.locator("select").selectOption("celebrations");
  await tools.locator('a[href^="/companies/lab?"]').first().click();
  await expect(page).toHaveURL(/\/companies\/lab\?type=celebrations/);
  await expect(page.locator("#lab-title")).toBeVisible();
  await expect(page.getByLabel("Place (optional)", { exact: true })).not.toHaveValue("");
});

test("the contact page preserves failed input, consent and idempotent receipt confirmation", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/company/inquiries", route => {
    requests.push(route.request().postDataJSON());
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { message: "Please retry shortly" } })
      : route.fulfill({ status: 201, json: { id: requests[1].requestId, submittedAt: new Date().toISOString() } });
  });
  await page.goto("/contact?type=real-estate&inquiry=partnership#inquiry");
  const form = page.locator(".company-inquiry-form");
  await form.getByLabel(/Company or organization/).fill("Example Partner");
  await form.getByLabel(/Your name/).fill("Test Contact");
  await form.getByLabel(/Work email/).fill("contact@example.test");
  await expect(form.locator("textarea")).toHaveValue(/^Partnership inquiry:/);
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: /Send inquiry/ }).click();
  await expect(form.getByRole("alert")).toContainText("Please retry shortly");
  await expect(form.getByLabel(/Company or organization/)).toHaveValue("Example Partner");
  await form.getByRole("button", { name: /Send inquiry/ }).click();
  await expect(form.locator(".company-success")).toContainText("Reference");
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[1].companyType).toBe("real-estate");
  expect(requests[1].consent).toBe(true);
});

test("older company bookmarks lead to the right new page or live guest workflow", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/partners$/);
  await page.goto("/companies?inquiry=partnership&type=celebrations#inquiry");
  await expect(page).toHaveURL(/\/contact\?type=celebrations&inquiry=partnership#inquiry$/);
  await expect(page.locator(".company-inquiry-form select")).toHaveValue("celebrations");
  await page.goto("/companies?type=hospitality&place=Chicago&occasion=Team+visit#company-type");
  await expect(page).toHaveURL(/\/companies\/discover\?/);
  await expect(page.getByLabel("Place you’re exploring", { exact: true })).toHaveValue("Chicago");
  await expect(page.locator("#company-tools")).toHaveAttribute("open");
});

test("the commercial navigation remains readable and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/partners", "/contact", "/mockups"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Business Model and Partnerships", exact: true })).toBeVisible();
  }
});
