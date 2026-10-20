import { test, expect, type Page } from "@playwright/test";

async function renderProgressFixture(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    // Test-only isolated render: production authentication and routes remain unchanged.
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const viewPath = "/src/ProgressView.tsx";
    const reactModule = await import(/* @vite-ignore */ reactPath);
    const React = reactModule.default || reactModule;
    const domModule = await import(/* @vite-ignore */ domPath);
    const { createRoot } = domModule.default || domModule;
    const { default: ProgressView } = await import(/* @vite-ignore */ viewPath);
    const app = document.getElementById("root");
    if (app) app.style.display = "none";
    const host = document.createElement("main");
    host.id = "progress-component-test";
    host.className = "page";
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(ProgressView, {
      summary: { doorsOpened: 15, braveDoorsOpened: 5, categories: ["Art", "Books", "Film", "Food", "Music"] },
      savedCount: 10, status: "ready", error: "", onRetry: () => {},
    }));
  });
  await expect(page.locator("#progress-component-test").getByRole("heading", { name: "Every open door counts." })).toBeVisible();
}

test("Guest exploration, login alternatives, and protected progress stay separate", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Progress", exact: true })).toHaveCount(0);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Sign in to see your progress." })).toBeVisible();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Open the door", exact: true })).toBeVisible();
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue as guest" })).toBeVisible();
  expect((await request.get("/api/account/saved-doors")).status()).toBe(401);
  expect((await request.get("/api/account/progress")).status()).toBe(401);
  expect((await request.post("/api/account/progress/doors", {
    data: { userId: "forged", doors: [{ id: "fake", tier: "Unexpected", category: "Art" }] },
  })).status()).toBe(401);
});

test("reward page renders mascot art, all tracks and rewards, with private sharing", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await renderProgressFixture(page);
  const progress = page.locator("#progress-component-test");
  await expect(progress.getByRole("heading", { name: "Brave", exact: true })).toBeVisible();
  await expect(progress.getByRole("heading", { name: "Explorer", exact: true })).toBeVisible();
  await expect(progress.getByRole("heading", { name: "Door Collector", exact: true })).toBeVisible();
  await expect(progress.getByRole("img", { name: "5 of 5 exploration stars earned" })).toBeVisible();
  await expect(progress.getByRole("heading", { name: "Your gold Field Guide trophy." })).toBeVisible();
  await expect(progress.locator(".reward-medal-gold.is-earned")).toHaveCount(3);
  await expect(progress.locator(".progress-concept img")).toBeVisible();
  await expect.poll(() => progress.locator(".progress-concept img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await progress.getByRole("button", { name: "Copy summary" }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toContain("Brave: Gold");
  expect(shared).toContain("5 of 5");
  expect(shared).not.toMatch(/Brooklyn|experimental jazz|clerk_user_id|user_/);
  await expect(progress.getByRole("link", { name: "Share progress on X" })).toHaveAttribute("href", /^https:\/\/x.com\/intent\/post\?text=/);
  await expect(progress.getByRole("link", { name: "Share Open Door on LinkedIn" })).toHaveAttribute("href", /^https:\/\/www.linkedin.com\/sharing\/share-offsite\//);
  await page.screenshot({ path: "generated-artifacts/rewards/progress-desktop.jpg", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress.getByRole("heading", { name: "Every open door counts." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/rewards/progress-mobile.jpg", fullPage: true });
});
