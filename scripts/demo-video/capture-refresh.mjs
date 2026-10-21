import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

const checking = process.argv.includes("--check");
const onlyYourDay = process.argv.includes("--only-your-day");
const selectedScenes = process.argv.find(argument => argument.startsWith("--scenes="))?.slice(9).split(",");
const out = path.resolve("generated-artifacts/demo-refresh");
const plan = JSON.parse(readFileSync("scripts/demo-video/refresh-plan.json", "utf8"));
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("The app development domain is required.");
mkdirSync(`${out}/raw`, { recursive: true });
for (const name of ["music.mp3", "door-chime.mp3"]) {
  copyFileSync(`generated-artifacts/demo-video/${name}`, `${out}/${name}`);
}
const browser = await chromium.launch({
  headless: true,
  ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1, acceptDownloads: true,
  ...(!checking ? { recordVideo: { dir: `${out}/raw`, size: { width: 1440, height: 810 } } } : {}),
});
const recordingStarted = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.addInitScript(() => { window.print = () => {}; });
const manifest = {};

async function scroll(selector, block = "start") {
  await page.locator(selector).first().evaluate((element, position) =>
    element.scrollIntoView({ behavior: "smooth", block: position }), block);
}
async function scene(id, work) {
  const definition = plan.find(item => item.id === id);
  const record = !selectedScenes || selectedScenes.includes(id);
  const started = Date.now();
  const at = async seconds => {
    if (checking || !record) return;
    const remaining = seconds * 1000 - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
  };
  const capture = { start: (started - recordingStarted) / 1000, duration: definition.duration };
  console.log(`${checking ? "Checking" : "Recording"} ${id}`);
  await work(at);
  if (!checking && record && Date.now() - started > (definition.duration - 0.4) * 1000) {
    throw new Error(`${id}: actions exceeded the planned duration; refusing to trim away a feature.`);
  }
  await at(definition.duration);
  await page.screenshot({ path: `${out}/${id}${checking ? "-check" : ""}.jpg` });
  if (record) manifest[id] = capture;
}
async function branch(name) {
  await page.locator(".lab-direction").filter({ hasText: name }).click();
  await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
  await expect(page.locator(".lab-discovery")).toHaveCount(3);
  await expect(page.locator(".lab-busy")).toHaveCount(0);
}
async function previewRewards() {
  await page.evaluate(async () => {
    // Video-only preview of the existing component, with explicitly labeled
    // sample milestones. No account, API, or production authentication changes.
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
    window.scrollTo(0, 0);
  });
  await expect(page.locator(".progress-tracks")).toBeVisible();
}

try {
  await page.goto(`${baseURL}/demo`);
  await expect(page.locator(".form-panel")).toBeVisible();
  await scroll(".form-panel");

  await scene("02-your-day", async at => {
    await page.locator("#city").fill("Brooklyn, New York");
    while (await page.getByRole("button", { name: /^Remove / }).count()) {
      await page.getByRole("button", { name: /^Remove / }).first().click();
    }
    for (const interest of ["Music", "Art"]) {
      await page.locator("#anchor-input").fill(interest);
      await page.locator("#anchor-input").press("Enter");
    }
    await at(4);
    await scroll("#occasion", "center");
    await page.locator("#occasion").selectOption("My first week here");
    await at(8);
    await page.locator("#occasion").selectOption("A day with a friend");
    await at(12);
    await page.locator("#occasion").selectOption("A solo afternoon");
    await at(15);
    await page.locator("#occasion").selectOption("Something else, soon");
    await at(18);
    await page.locator("#occasion").selectOption("A day with a friend");
    await page.locator("#budget").selectOption("Free or low-cost");
    await page.locator("#movement").selectOption("Easy walking");
    const selector = page.getByRole("combobox", { name: "Personal considerations", exact: true });
    if (!await selector.isVisible()) await page.locator("summary").filter({ hasText: "Personal considerations" }).click();
    await at(21);
    await selector.evaluate(element => element.scrollIntoView({ behavior: "smooth", block: "center" }));
    await selector.selectOption("personal-style");
    await at(23);
    await selector.selectOption("age-aware");
    await at(25);
    await selector.selectOption("wellbeing");
    await at(27);
    await selector.selectOption("custom");
    await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill("I love music and art. I want a relaxed afternoon with a friend, with time to pause and a small budget.");
    await at(31);
    await page.getByRole("button", { name: "Find my doors", exact: true }).click();
    await expect(page.locator(".door-card h3").first()).toHaveText("Make a three-song playlist");
    await scroll(".result-top");
  });

  if (!onlyYourDay) {
  await scene("03-open-a-door", async at => {
    await at(3);
    await page.locator(".door-card .door-preview").first().click();
    await expect(page.locator(".door-card.is-expanded .door-result-expanded")).toBeVisible();
    await scroll(".door-card.is-expanded .door-result-expanded");
    await expect(page.locator(".door-card.is-expanded .door-result-expanded")).toContainText("Why you might enjoy it");
    await at(12);
    await page.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
    await scroll(".hidden-gem-content");
    await at(19);
    await page.getByRole("button", { name: "Explore more ideas", exact: true }).click();
    await expect(page.locator(".door-card.is-expanded .door-result-expanded")).toContainText("music and art");
    await scroll(".door-card.is-expanded .door-result-expanded");
  });

  await scene("04-make-a-plan", async at => {
    const map = page.locator(".door-map-link").first();
    if (!(await map.getAttribute("href")).startsWith("https://www.google.com/maps/search/")) {
      throw new Error("The recommendation must have a real Maps search link.");
    }
    await at(1);
    await map.hover();
    await at(6);
    await page.getByRole("button", { name: "Plan these ideas", exact: true }).click();
    await scroll("#day-plan");
    await at(9);
    await page.getByRole("button", { name: "Suggest a plan that fits", exact: true }).click();
    await expect(page.locator(".planner-item")).toHaveCount(3);
    await at(12);
    await page.locator(".planner-item").first().getByRole("button", { name: /later/ }).click();
    await page.locator(".planner-check").first().click();
    await at(16);
    await page.getByRole("button", { name: "I have one hour", exact: true }).click();
    await expect(page.locator(".planner-item")).toHaveCount(1);
    await at(19);
    await page.getByRole("button", { name: "Show all ideas", exact: true }).click();
    await at(21);
    await page.getByRole("button", { name: "Print recommendations", exact: true }).click();
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await at(24);
    await page.emulateMedia({ media: "screen" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download.*Word/i }).first().click();
    const download = await downloadPromise;
    await download.saveAs(`${out}/Recorded-recommendations.docx`);
  });

  await scene("05-discovery-lab", async at => {
    await page.goto(`${baseURL}/lab`);
    await page.getByRole("combobox", { name: "Lab scenario", exact: true }).selectOption("wellbeing");
    await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill("I want a quiet, low-pressure afternoon with flexible timing, a seated option, and a chance to pause.");
    await page.getByLabel("Cultural interest", { exact: true }).fill("music and art");
    await page.getByRole("button", { name: "Add anchor", exact: true }).click();
    await at(5);
    await page.getByRole("button", { name: /^Start exploring/ }).click();
    await at(8);
    page.once("dialog", dialog => dialog.accept("A relaxed afternoon"));
    await page.getByRole("button", { name: "Save checkpoint", exact: true }).click();
    await at(10);
    await branch("Stay in Your World");
    await scroll(".lab-discovery");
    await at(14);
    await page.getByRole("button", { name: "Return here", exact: true }).first().click();
    await branch("Take the Wild Door");
    await at(20);
    await page.getByRole("combobox", { name: "Shared checkpoint", exact: true }).selectOption({ index: 1 });
    await page.locator(".lab-compare-picker input").nth(0).check();
    await page.locator(".lab-compare-picker input").nth(1).check();
    await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
    await scroll(".lab-compare-columns");
  });

  await scene("06-qloo", async at => {
    await page.goto(`${baseURL}/how`);
    await page.getByRole("button", { name: "How it works", exact: true }).click();
    await scroll(".architecture-section");
    await at(7);
    await scroll(".architecture-flow");
    await at(13);
    await scroll(".architecture-status", "center");
  });

  await scene("07-save", async at => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Discover", exact: true }).click();
    const entry = page.getByRole("button", { name: "Open the illustrated door", exact: true });
    if (await entry.isVisible()) await entry.click();
    const first = page.locator(".door-card").first();
    const title = await first.locator("h3").innerText();
    await first.getByRole("button", { name: `Save ${title}`, exact: true }).click();
    await at(4);
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /^My Doors/ }).click();
    await expect(page.locator(".saved-row")).toContainText(title);
    await scroll(".saved-row", "center");
    await at(10);
    await page.goto(`${baseURL}/sign-in`);
    await expect(page.locator(".auth-panel")).toBeVisible();
    await at(14);
    await previewRewards();
    await at(18);
    await scroll(".progress-tracks", "center");
  });
  }
  if (errors.length) throw new Error(`App errors during capture: ${errors.join("; ")}`);
  console.log("All recorded interactions completed without app errors.");
} finally {
  const video = page.video();
  await page.close();
  if (video) {
    const file = await video.path();
    for (const capture of Object.values(manifest)) capture.file = file;
    const previous = existsSync(`${out}/captures.json`) ? JSON.parse(readFileSync(`${out}/captures.json`, "utf8")) : {};
    writeFileSync(`${out}/captures.json`, JSON.stringify({ ...previous, ...manifest }, null, 2));
  }
  await context.close();
  await browser.close();
}
