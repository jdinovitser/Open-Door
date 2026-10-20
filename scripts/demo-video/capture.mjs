import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("generated-artifacts/demo-video");
mkdirSync(out, { recursive: true });
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  headless: true,
  ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
  recordVideo: { dir: `${out}/raw`, size: { width: 1440, height: 810 } },
});
const manifest = {};

async function scroll(page, selector, block = "center") {
  await page.locator(selector).first().evaluate((element, position) => {
    element.scrollIntoView({ behavior: "smooth", block: position });
  }, block);
}
async function capture(id, duration, work) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const start = Date.now();
  const at = async seconds => {
    const remaining = seconds * 1000 - (Date.now() - start);
    if (remaining > 0) await page.waitForTimeout(remaining);
  };
  console.log(`Recording ${id}`);
  await work(page, at);
  await at(duration + 0.5);
  await page.screenshot({ path: `${out}/${id}-check.jpg` });
  const video = page.video();
  await page.close();
  manifest[id] = { file: await video.path(), duration };
  writeFileSync(`${out}/captures.json`, JSON.stringify(manifest, null, 2));
  console.log(`Captured ${id}: ${((Date.now() - start) / 1000).toFixed(1)} seconds`);
}
async function enter(page) {
  const entry = page.getByRole("button", { name: "Open the door", exact: true });
  if (await entry.isVisible()) {
    await entry.click();
    await page.waitForTimeout(1100);
  }
}
async function rewardPreview(page) {
  await page.evaluate(async () => {
    // Isolated video-only component preview; no shipped auth bypass or API mock.
    const reactModule = await import("/node_modules/.vite/deps/react.js");
    const React = reactModule.default || reactModule;
    const domModule = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { createRoot } = domModule.default || domModule;
    const { default: ProgressView } = await import("/src/ProgressView.tsx");
    document.getElementById("root").style.display = "none";
    const host = document.createElement("main");
    host.className = "page";
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(ProgressView, {
      summary: { doorsOpened: 15, braveDoorsOpened: 5, categories: ["Art", "Books", "Film", "Food", "Music"] },
      savedCount: 10, status: "ready", error: "", onRetry: () => {},
    }));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}

try {
  await capture("02-start", 22, async (page, at) => {
    await page.goto(baseURL);
    await at(2);
    await enter(page);
    await at(5);
    await scroll(page, ".form-panel", "start");
    await page.locator("#city").fill("Brooklyn");
    await at(8);
    await page.locator("#anchor-input").pressSequentially("Independent film", { delay: 70 });
    await page.locator("#anchor-input").press("Enter");
    await at(11);
    await page.locator("#anchor-input").pressSequentially("Jazz", { delay: 90 });
    await page.locator("#anchor-input").press("Enter");
    await at(14);
    await page.locator("#anchor-input").pressSequentially("Coffee", { delay: 90 });
    await page.locator("#anchor-input").press("Enter");
    await at(18);
    await page.getByRole("button", { name: "Find my doors", exact: true }).click();
    await at(20);
    await scroll(page, ".journey-result", "start");
  });
  await capture("03-doors", 20, async (page, at) => {
    await page.goto(baseURL);
    await enter(page);
    await scroll(page, ".journey-result", "start");
    await at(5);
    await page.getByRole("button", { name: /^Open unexpected door:/ }).click();
    await at(11);
    await page.getByRole("button", { name: "Close this door", exact: true }).click();
    await at(14);
    await page.locator(".door-card").last().getByRole("button", { name: /^Save / }).click();
    await at(17);
    await page.getByRole("button", { name: "Under the Door", exact: true }).click();
    await scroll(page, ".provenance", "start");
  });
  await capture("04-qloo", 28, async (page, at) => {
    await page.goto(`${baseURL}/how`);
    await page.getByRole("button", { name: "How it works", exact: true }).click();
    await at(2);
    await scroll(page, ".architecture-section", "start");
    await at(13);
    await scroll(page, ".architecture-status", "center");
    await at(22);
    await scroll(page, ".architecture-flow", "start");
  });
  await capture("05-lab", 20, async (page, at) => {
    await page.goto(`${baseURL}/lab`);
    await page.getByLabel("Cultural interest", { exact: true }).fill("Jazz");
    await page.getByRole("button", { name: "Add anchor", exact: true }).click();
    await page.getByRole("button", { name: /^Start exploring/ }).click();
    page.once("dialog", dialog => dialog.accept("My first neighborhood thread"));
    await page.getByRole("button", { name: "Save checkpoint", exact: true }).click();
    await at(5);
    await page.locator(".lab-direction").filter({ hasText: "Stay in Your World" }).click();
    await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
    await page.locator(".lab-discovery").first().waitFor();
    await at(10);
    await page.getByRole("button", { name: "Return here", exact: true }).first().click();
    await page.locator(".lab-direction").filter({ hasText: "Take the Wild Door" }).click();
    await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
    await page.locator(".lab-discovery").first().waitFor();
    await at(15);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("opendoor.lab.v1")));
    await page.getByRole("combobox", { name: "Shared checkpoint", exact: true }).selectOption(state.checkpoints[0].id);
    await page.locator(".lab-compare-picker input").nth(0).check();
    await page.locator(".lab-compare-picker input").nth(1).check();
    await scroll(page, ".lab-compare-branch", "start");
  });
  await capture("06-progress", 37, async (page, at) => {
    await page.goto(baseURL);
    await page.getByRole("button", { name: /^My Doors/ }).click();
    await at(7);
    await page.goto(`${baseURL}/sign-in`);
    await at(17);
    await page.goto(baseURL);
    await rewardPreview(page);
    await at(23);
    await scroll(page, ".progress-tracks", "start");
    await at(29);
    await scroll(page, ".field-guide-trophy", "center");
    await at(33);
    await scroll(page, ".progress-share", "center");
  });
} finally {
  await context.close();
  await browser.close();
}
