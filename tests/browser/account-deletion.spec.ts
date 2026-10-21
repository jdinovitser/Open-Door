import { test, expect, type Page } from "@playwright/test";

async function renderPrivacyFixture(page: Page, signedIn = true, busy = false, error = false) {
  await page.goto("/");
  await page.evaluate(async ({ signedIn, busy, error }) => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const viewPath = "/src/TrustView.tsx";
    const reactModule = await import(/* @vite-ignore */ reactPath);
    const React = reactModule.default || reactModule;
    const domModule = await import(/* @vite-ignore */ domPath);
    const { createRoot } = domModule.default || domModule;
    const { TrustView } = await import(/* @vite-ignore */ viewPath);
    // Isolated component fixture, never an authentication bypass in app code.
    const app = document.getElementById("root");
    if (app) app.style.display = "none";
    const host = document.createElement("main");
    host.id = "privacy-fixture";
    host.className = "page";
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(TrustView, {
      signedIn, cloudBusy: busy, cloudError: error,
      cloudMessage: error ? "Cloud doors and rewards were erased. Account closure is not confirmed yet; retry." : "",
      personalizationEnabled: true, savedCount: 3,
      savedStorageScope: signedIn ? "your account" : "this browser",
      onDeleteCloud: (scope: string) => { document.body.dataset.deletedScope = scope; },
      onPersonalizationChange: () => {}, onExport: () => {}, onDeleteJourney: () => {},
      onClearSignals: () => {}, onDeleteSaved: () => {}, onClearAll: () => {},
    }));
  }, { signedIn, busy, error });
  await expect(page.locator("#privacy-fixture").getByRole("heading", { name: "Your data controls" })).toBeVisible();
  return page.locator("#privacy-fixture");
}

test("cloud erasure and closure require explicit confirmation and explain local boundaries", async ({ page }) => {
  const view = await renderPrivacyFixture(page);
  const erase = view.getByRole("button", { name: "Erase all cloud data" });
  page.once("dialog", async dialog => {
    expect(dialog.message()).toContain("Guest and Discovery Lab data");
    await dialog.dismiss();
  });
  await erase.click();
  expect(await page.evaluate(() => document.body.dataset.deletedScope)).toBeUndefined();
  page.once("dialog", dialog => dialog.accept());
  await erase.click();
  expect(await page.evaluate(() => document.body.dataset.deletedScope)).toBe("all");
  page.once("dialog", async dialog => {
    expect(dialog.message()).toContain("Permanently close");
    expect(dialog.message()).toContain("retried automatically");
    await dialog.accept();
  });
  await view.getByRole("button", { name: "Close account permanently" }).click();
  expect(await page.evaluate(() => document.body.dataset.deletedScope)).toBe("close");
});

test("busy destructive controls cannot be repeated, and partial closure is an error, not success", async ({ page }) => {
  const view = await renderPrivacyFixture(page, true, true, true);
  for (const name of ["Erase cloud rewards", "Erase cloud saved doors", "Erase all cloud data", "Close account permanently"]) {
    await expect(view.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await expect(view.getByRole("alert")).toContainText("Account closure is not confirmed yet");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Guest privacy has browser controls but no cloud erasure or account-closure action", async ({ page }) => {
  const view = await renderPrivacyFixture(page, false);
  await expect(view.getByRole("button", { name: "Delete Guest-saved doors (3)" })).toBeVisible();
  await expect(view.getByRole("button", { name: "Close account permanently" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Erase cloud rewards" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: /Clear browser journey/ })).toBeVisible();
});
