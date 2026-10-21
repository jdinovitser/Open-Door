import { chromium, expect } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const checking = process.argv.includes("--check");
const out = path.resolve("generated-artifacts/demo-story");
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("The app development domain is required.");
const plan = JSON.parse(readFileSync("scripts/demo-video/story-plan.json", "utf8"));
const previous = JSON.parse(readFileSync("generated-artifacts/demo-refresh/captures.json", "utf8"));
mkdirSync(`${out}/raw`, { recursive: true });
for (const name of ["music.mp3", "door-chime.mp3"]) {
  copyFileSync(`generated-artifacts/demo-refresh/${name}`, `${out}/${name}`);
}
// Keep the real, verified feature recordings. Only the setup and Qloo
// chapter need fresh footage; every chapter receives new narration.
const manifest = Object.fromEntries(
  ["03-open-a-door", "04-make-a-plan", "05-discovery-lab", "07-save"]
    .map(id => [id, { ...previous[id] }]),
);
manifest["05-discovery-lab"].playbackRate =
  previous["05-discovery-lab"].duration / plan.find(scene => scene.id === "05-discovery-lab").duration;
const browser = await chromium.launch({
  headless: true,
  ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1,
  ...(!checking ? { recordVideo: { dir: `${out}/raw`, size: { width: 1440, height: 810 } } } : {}),
});
const recordingStarted = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const newClips = {};
async function scroll(selector, block = "start") {
  await page.locator(selector).first().evaluate((element, position) =>
    element.scrollIntoView({ behavior: "smooth", block: position }), block);
}
async function capture(id, work) {
  console.log(`${checking ? "Checking" : "Recording"} ${id}`);
  const definition = plan.find(scene => scene.id === id);
  const started = Date.now();
  const at = async seconds => {
    if (checking) return;
    const remaining = seconds * 1000 - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
  };
  await work(at);
  if (!checking && Date.now() - started > (definition.duration - 0.4) * 1000) {
    throw new Error(`${id}: actions would run beyond the planned chapter.`);
  }
  await at(definition.duration);
  await page.screenshot({ path: `${out}/${id}${checking ? "-check" : ""}.jpg` });
  newClips[id] = { start: (started - recordingStarted) / 1000, duration: definition.duration };
}
let completed = false;
try {
  await page.goto(`${baseURL}/demo`);
  await expect(page.locator(".form-panel")).toBeVisible();
  await scroll(".hero");
  await capture("02-your-day", async at => {
    await at(2);
    await scroll(".form-panel");
    await page.locator("#city").fill("Brooklyn, New York");
    await page.locator("#occasion").selectOption("A day with a friend");
    while (await page.getByRole("button", { name: /^Remove / }).count()) {
      await page.getByRole("button", { name: /^Remove / }).first().click();
    }
    for (const interest of ["Music", "Art"]) {
      await page.locator("#anchor-input").fill(interest);
      await page.locator("#anchor-input").press("Enter");
    }
    await at(8);
    await page.locator("#budget").selectOption("Free or low-cost");
    await page.locator("#movement").selectOption("Easy walking");
    const selector = page.getByRole("combobox", { name: "Personal considerations", exact: true });
    if (!await selector.isVisible()) {
      await page.locator("summary").filter({ hasText: "Personal considerations" }).click();
    }
    await at(11);
    await selector.evaluate(element => element.scrollIntoView({ behavior: "smooth", block: "center" }));
    await selector.selectOption("wellbeing");
    await at(16);
    await selector.selectOption("custom");
    await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill(
      "I love music and art. I want a relaxed afternoon with a friend, with time to pause and a small budget.",
    );
    await at(22);
    await page.getByRole("button", { name: "Find my doors", exact: true }).click();
    await expect(page.locator(".door-card h3").first()).toHaveText("Make a three-song playlist");
    await scroll(".result-top");
  });
  await capture("06-qloo", async at => {
    await page.getByRole("button", { name: "How it works", exact: true }).click();
    await scroll(".architecture-section");
    await at(9);
    await scroll(".architecture-flow");
    await at(19);
    await scroll(".architecture-status", "center");
  });
  if (errors.length) throw new Error(`App errors: ${errors.join("; ")}`);
  completed = true;
  console.log("The story-led setup and Qloo walkthrough completed without app errors.");
} finally {
  const video = page.video();
  await page.close();
  if (video && completed) {
    const file = await video.path();
    for (const clip of Object.values(newClips)) clip.file = file;
    writeFileSync(`${out}/captures.json`, JSON.stringify({ ...manifest, ...newClips }, null, 2));
  }
  await context.close();
  await browser.close();
}
