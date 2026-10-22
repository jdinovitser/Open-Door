import { expect, test } from "@playwright/test";
import { COMPANY_PROFILES } from "../../src/company/profiles";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: false, demoAvailable: true,
  } }));
});

for (const profile of COMPANY_PROFILES) {
  test(`${profile.id}: portal opens dedicated editable Discovery and Lab defaults`, async ({ page }) => {
    await page.goto("/companies");
    await page.locator("#company-type").selectOption(profile.id);
    await expect(page.locator(".company-profile-spotlight")).toContainText(profile.summary);
    await page.getByRole("link", { name: /^Try discovery/ }).click();
    await expect(page).toHaveURL(new RegExp(`/companies/discover\\?type=${profile.id}`));
    await expect(page.getByRole("heading", { name: profile.discoveryTitle, exact: true })).toBeVisible();
    await expect(page.locator("#city")).toHaveValue(profile.location);
    await expect(page.locator("#occasion")).toHaveValue(profile.occasion);
    await expect(page.locator("#movement")).toHaveValue(profile.context.movement);
    await expect(page.locator("#budget")).toHaveValue(profile.context.budget);
    await page.locator("#occasion").fill("Our own event afternoon");
    await expect(page.locator("#occasion")).toHaveValue("Our own event afternoon");
    await page.getByRole("link", { name: "Try the idea lab", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/companies/lab\\?type=${profile.id}`));
    await expect(page.getByRole("heading", { name: profile.labTitle, exact: true })).toBeVisible();
    await expect(page.locator("#lab-location")).toHaveValue(profile.location);
    for (const anchor of profile.anchors) await expect(page.locator(".lab-anchor-edit > strong").filter({ hasText: new RegExp(`^${anchor}$`, "i") })).toHaveCount(1);
    await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
    await page.getByRole("button", { name: /^Start exploring/ }).click();
    await expect(page.locator(".lab-sibling-card")).toHaveCount(1);
    const stored = await page.evaluate(id => JSON.parse(localStorage.getItem(`opendoor.company.${id}.lab.v1`) || "null"), profile.id);
    expect(stored.current.originalAnchors).toEqual([...profile.anchors]);
    expect(stored.current.settings.scenario).toBe(profile.context.scenario);
    expect(await page.evaluate(() => localStorage.getItem("opendoor.lab.v1"))).toBeNull();
  });
}

test("Other company explanation carries into its editable experience without appearing in the URL", async ({ page }) => {
  await page.goto("/companies");
  await page.locator("#company-type").selectOption("other");
  await page.locator("#company-type-description").fill("Museum visitors arriving for a festival");
  await page.getByRole("link", { name: "Open the idea lab", exact: true }).click();
  await expect(page.locator(".discovery-lab textarea")).toHaveValue(/Museum visitors arriving for a festival/);
  expect(page.url()).not.toContain("Museum");
});

test("customization form preserves failed input, retries with same ID, and confirms only a saved receipt", async ({ page }) => {
  const requests: any[] = [];
  await page.route("**/api/company/inquiries", async route => {
    requests.push(route.request().postDataJSON());
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { message: "Storage temporarily unavailable" } })
      : route.fulfill({ status: 201, json: { id: requests[1].requestId, submittedAt: new Date().toISOString() } });
  });
  await page.goto("/companies");
  await page.getByLabel(/Company or organization/).fill("Example Organization");
  await page.getByLabel(/Your name/).fill("Test Contact");
  await page.getByLabel(/Work email/).fill("contact@example.test");
  await page.getByRole("textbox", { name: /What would you like to explore together/ }).fill("We want a cultural discovery experience around our annual event.");
  await page.getByRole("checkbox", { name: /I agree that Open Door may store/ }).check();
  await page.getByRole("button", { name: /Send inquiry/ }).click();
  await expect(page.getByRole("alert")).toContainText("Storage temporarily unavailable");
  await expect(page.getByLabel(/Company or organization/)).toHaveValue("Example Organization");
  await expect(page.locator(".company-success")).toHaveCount(0);
  await page.getByRole("button", { name: /Send inquiry/ }).click();
  await expect(page.locator(".company-success")).toContainText("Reference");
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[1].consent).toBe(true);
});

test("company discovery reuses personal Qloo selection and sends edited inputs to the existing provider", async ({ page }) => {
  let request: any;
  await page.addInitScript(() => sessionStorage.setItem("opendoor.qloo.source", "personal"));
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: true, sharedQlooConfigured: true, personalQlooConnected: true,
  } }));
  await page.route("**/api/agent/discover", route => {
    request = { source: route.request().headers()["x-qloo-connection"], ...route.request().postDataJSON() };
    return route.fulfill({ status: 503, json: { message: "Test fixture: no live Qloo request sent" } });
  });
  await page.goto("/companies/discover?type=business");
  await page.locator("#city").fill("Boston");
  await page.locator("#budget").fill("Under $40");
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect.poll(() => request).toBeTruthy();
  expect(request.source).toBe("personal");
  expect(request.location).toBe("Boston");
  expect(request.context.budget).toBe("Under $40");
  expect(request.context.scenario).toBeUndefined();
  expect(request.anchors.map((item: any) => item.label)).toEqual([...COMPANY_PROFILES.find(profile => profile.id === "business")!.anchors]);
  await expect(page.locator(".live-error")).toContainText("Test fixture");
});

test("portal and dedicated pages fit phones, and admin sign-in never fetches private records for guests", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/companies");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "generated-artifacts/company-portal-mobile.png", fullPage: true });
  await page.goto("/companies/lab?type=hospitality");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  let privateReads = 0;
  await page.route("**/api/company/admin/inquiries**", route => { privateReads++; return route.abort(); });
  await page.goto("/companies/admin");
  await expect(page.getByRole("heading", { name: "Administrator access starts with your account." })).toBeVisible();
  expect(privateReads).toBe(0);
  expect((await request.get("/api/company/admin/inquiries")).status()).toBe(401);
});
