import { expect, test, type Page } from "@playwright/test";

async function connectionFixture(page: Page) {
  let connected = false;
  const sources: string[] = [];
  await page.route("**/api/status", route => {
    const personal = route.request().headers()["x-qloo-connection"] === "personal";
    return route.fulfill({ json: {
      qlooConfigured: personal ? connected : true,
      sharedQlooConfigured: true, personalQlooConnected: connected,
      connectionExpiresAt: connected ? new Date(Date.now() + 3_600_000).toISOString() : null,
      agent: "Test fixture", demoAvailable: true,
    } });
  });
  await page.route("**/api/qloo/connection", route => {
    if (route.request().method() === "DELETE") {
      connected = false;
      return route.fulfill({ json: { connected: false } });
    }
    const key = route.request().postDataJSON().apiKey;
    if (key === "fixture-invalid-key") return route.fulfill({ status: 401, json: { message: "Qloo did not accept this key." } });
    connected = true;
    return route.fulfill({ json: { connected: true } });
  });
  await page.route("**/api/agent/discover", route => {
    sources.push(route.request().headers()["x-qloo-connection"]);
    expect(route.request().postData()).not.toContain("fixture-personal-key");
    return route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "error", code: "FIXTURE_ERROR", message: "Fixture recommendation request received." }) + "\n",
    });
  });
  return sources;
}

test("personal connect, discovery, switching and disconnect use the selected source without storing a key", async ({ page }) => {
  const sources = await connectionFixture(page);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore with Qloo", exact: true })).toBeDisabled();
  await page.getByLabel("Your Qloo API key").fill("fixture-personal-key");
  await page.getByRole("button", { name: "Connect key", exact: true }).click();
  await expect(page.getByText("Your Qloo key is connected.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("discovery-connection-status")).toContainText("using your own connection");
  await expect(page.getByLabel("Your Qloo API key")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("fixture-personal-key");
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture recommendation" })).toBeVisible();
  expect(sources).toEqual(["personal"]);
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await expect(page.getByTestId("discovery-connection-status")).toContainText("using the shared Demo connection");
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture recommendation" })).toBeVisible();
  expect(sources).toEqual(["personal", "shared"]);
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByLabel("Your Qloo API key")).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore with Qloo", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("opendoor.qloo.source"))).toBe("personal");
});

test("invalid key fails visibly, clears password input and supports mobile layout", async ({ page }) => {
  await connectionFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await page.getByLabel("Your Qloo API key").fill("fixture-invalid-key");
  await page.getByRole("button", { name: "Connect key", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Qloo did not accept this key");
  await expect(page.getByLabel("Your Qloo API key")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Explore with Qloo", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".qloo-connection-panel").screenshot({ path: "generated-artifacts/qloo-connection-mobile.png" });
});

test("prepared examples remain explicit and network-independent", async ({ page }) => {
  const sources = await connectionFixture(page);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).first().click();
  await page.getByRole("button", { name: "Find my doors", exact: true }).click();
  await expect(page.locator(".door-card").first()).toBeVisible();
  expect(sources).toEqual([]);
  await expect(page.locator(".demo-note").first()).toContainText("authored activities");
  await expect(page.getByTestId("discovery-connection-status")).toContainText("Prepared examples selected");
  await expect(page.locator(".result-truth-note")).toContainText("prepared example activities");
  await page.locator(".qloo-connection-panel").screenshot({ path: "generated-artifacts/qloo-connection-desktop.png" });
});

test("loading status never claims that the shared connection is unavailable", async ({ page }) => {
  let releaseStatus!: () => void;
  const pending = new Promise<void>(resolve => { releaseStatus = resolve; });
  await page.route("**/api/status", async route => {
    await pending;
    await route.fulfill({ json: {
      qlooConfigured: true, sharedQlooConfigured: true,
      personalQlooConnected: false, agent: "Test fixture", demoAvailable: true,
    } });
  });
  await page.goto("/demo");
  await expect(page.getByTestId("discovery-connection-status")).toContainText("Checking Qloo connection");
  await expect(page.locator(".footer-note")).toContainText("PREPARED EXAMPLE RESULTS");
  await expect(page.locator(".footer-note")).not.toContainText("DEMO PATHS ARE AUTHORED EXAMPLES");
  await expect(page.getByText("Shared live recommendations aren’t available right now.", { exact: true })).toHaveCount(0);
  releaseStatus();
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await expect(page.getByTestId("discovery-connection-status")).toContainText("Qloo ready");
  await expect(page.getByTestId("discovery-connection-status")).toContainText("shared Demo connection");
});

test("a missing shared connection is reported only after status is known", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: {
    qlooConfigured: false, sharedQlooConfigured: false,
    personalQlooConnected: false, agent: "Test fixture", demoAvailable: true,
  } }));
  await page.goto("/demo");
  await expect(page.getByText("Shared live recommendations aren’t available right now.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Connect your own", exact: true }).click();
  await expect(page.getByTestId("discovery-connection-status")).toContainText("Connect your Qloo key below");
});
