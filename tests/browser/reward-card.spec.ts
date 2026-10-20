import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, state = "full", sharing = "unsupported", status = "ready") {
  await page.goto("/");
  await page.evaluate(async ({ state, sharing, status }) => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: sharing === "throw-can-share"
      ? () => { throw new Error("Unsupported"); }
      : () => sharing !== "unsupported" });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      if (sharing === "cancel") throw new DOMException("Cancelled", "AbortError");
      if (sharing === "fail") throw new Error("Not allowed");
      const file = data.files![0];
      document.body.dataset.shared = JSON.stringify({
        keys: Object.keys(data), name: file.name, type: file.type, size: file.size,
      });
    } });
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const viewPath = "/src/ProgressView.tsx";
    const ReactModule = await import(/* @vite-ignore */ reactPath);
    const React = ReactModule.default || ReactModule;
    const domModule = await import(/* @vite-ignore */ domPath);
    const { createRoot } = domModule.default || domModule;
    const { default: View } = await import(/* @vite-ignore */ viewPath);
    document.getElementById("root")!.style.display = "none";
    const host = document.createElement("main");
    host.id = "card-test";
    host.className = "page";
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(View, {
      summary: {
        doorsOpened: state === "zero" ? 0 : state === "partial" ? 3 : 15,
        braveDoorsOpened: state === "zero" ? 0 : state === "partial" ? 1 : 5,
        categories: state === "zero" ? [] : state === "partial" ? ["private-interest"] : ["a", "b", "c", "d", "e"],
        email: "private@example.test", location: "Brooklyn", accountId: "user_private",
      },
      savedCount: state === "full" ? 10 : 0, status, error: "Could not load", onRetry: () => {},
    }));
  }, { state, sharing, status });
  return page.locator("#card-test");
}

for (const state of ["zero", "partial", "full"]) {
  test(`${state} reward card previews and downloads a valid PNG on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const progress = await fixture(page, state);
    await expect(progress.locator(".reward-card-image")).toHaveCount(0);
    await progress.getByRole("button", { name: "Create reward card" }).click();
    const preview = progress.locator(".reward-card-image");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("alt", state === "zero"
      ? /no medals yet; no trophy yet; 0 earned stars/
      : state === "partial" ? /Brave bronze, Explorer bronze; no trophy yet; 2 earned stars/
        : /Brave gold, Explorer gold, Door Collector gold; gold trophy; 5 earned stars/);
    const dimensions = await preview.evaluate(async image => {
      const blob = await (await fetch((image as HTMLImageElement).src)).blob();
      const bitmap = await createImageBitmap(blob);
      return { width: bitmap.width, height: bitmap.height, type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer()).slice(0, 8)] };
    });
    expect(dimensions).toEqual({ width: 1200, height: 900, type: "image/png", bytes: [137, 80, 78, 71, 13, 10, 26, 10] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(progress.getByRole("button", { name: "Share card…" })).toHaveCount(0);
    const downloadEvent = page.waitForEvent("download");
    await progress.getByRole("link", { name: "Download PNG" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("open-door-rewards.png");
    expect(await download.failure()).toBeNull();
    await download.saveAs(`generated-artifacts/reward-card/${state}.png`);
    if (state === "full") await page.screenshot({ path: "generated-artifacts/reward-card/mobile.jpg", fullPage: true });
    await progress.getByRole("button", { name: "Hide reward card" }).click();
    await expect(preview).toHaveCount(0);
  });
}

test("native file sharing contains only the PNG and leaves download available", async ({ page }) => {
  const progress = await fixture(page, "full", "supported");
  await progress.getByRole("button", { name: "Create reward card" }).click();
  await progress.getByRole("button", { name: "Share card…" }).click();
  await expect(progress.getByText("Reward card shared.", { exact: true })).toBeVisible();
  const shared = await page.evaluate(() => JSON.parse(document.body.dataset.shared!));
  expect(shared.keys).toEqual(["files"]);
  expect(shared.name).toBe("open-door-rewards.png");
  expect(shared.type).toBe("image/png");
  expect(shared.size).toBeGreaterThan(10000);
  await expect(progress.getByRole("link", { name: "Download PNG" })).toBeVisible();
  await page.screenshot({ path: "generated-artifacts/reward-card/desktop.jpg", fullPage: true });
});

for (const scenario of ["cancel", "fail", "throw-can-share"]) {
  test(`${scenario} keeps the download fallback without an unexpected download`, async ({ page }) => {
    const progress = await fixture(page, "partial", scenario);
    let downloads = 0;
    page.on("download", () => downloads++);
    await progress.getByRole("button", { name: "Create reward card" }).click();
    await expect(progress.getByRole("link", { name: "Download PNG" })).toBeVisible();
    if (scenario === "throw-can-share") {
      await expect(progress.getByRole("button", { name: "Share card…" })).toHaveCount(0);
    } else {
      await progress.getByRole("button", { name: "Share card…" }).click();
      await expect(progress.getByText(scenario === "cancel" ? /Sharing cancelled/ : /Use Download PNG instead/)).toBeVisible();
    }
    expect(downloads).toBe(0);
  });
}

test("artwork failure is explicit and retry works", async ({ page }) => {
  const progress = await fixture(page);
  await page.route("**/mascot/open-door-reward-concept.png", route => route.abort());
  await progress.getByRole("button", { name: "Create reward card" }).click();
  await expect(progress.getByRole("alert")).toContainText("We couldn’t create your card");
  await expect(progress.getByRole("link", { name: "Download PNG" })).toHaveCount(0);
  await page.unroute("**/mascot/open-door-reward-concept.png");
  await progress.getByRole("button", { name: "Retry card" }).click();
  await expect(progress.getByRole("link", { name: "Download PNG" })).toBeVisible();
});

for (const status of ["loading", "error"]) {
  test(`cannot export ${status} progress`, async ({ page }) => {
    const progress = await fixture(page, "full", "supported", status);
    await expect(progress.getByRole("button", { name: "Create reward card" })).toHaveCount(0);
  });
}
