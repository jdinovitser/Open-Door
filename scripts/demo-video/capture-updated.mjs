import { chromium, expect } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = path.resolve("generated-artifacts/demo-updated");
const plan = JSON.parse(readFileSync("scripts/demo-video/updated-plan.json", "utf8"));
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("A running development domain is required.");
mkdirSync(`${out}/raw`, { recursive: true });
for (const name of ["music.mp3", "door-chime.mp3"]) copyFileSync(`generated-artifacts/demo-story/${name}`, `${out}/${name}`);
const requested = process.env.OPEN_DOOR_CAPTURE_SCENES?.split(",");
const manifest = existsSync(`${out}/captures.json`) ? JSON.parse(readFileSync(`${out}/captures.json`, "utf8")) : {};
const evidence = existsSync(`${out}/capture-evidence.json`)
  ? JSON.parse(readFileSync(`${out}/capture-evidence.json`, "utf8"))
  : { liveRequests: [], errors: [], voice: "Scripted transcript UI preview; native microphone access denied in this recorder." };
const browser = await chromium.launch({
  headless: true,
  ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1,
  permissions: ["clipboard-read", "clipboard-write"],
  acceptDownloads: true,
  recordVideo: { dir: `${out}/raw`, size: { width: 1440, height: 810 } },
});

// This only stages the explicitly labeled voice UI preview in the capture browser.
// No discovery, Qloo, account, branching or partnership responses are intercepted.
await context.addInitScript(() => {
  class PreviewRecognition {
    start() {
      this.timer = setTimeout(() => {
        this.onstart?.();
        this.timer = setTimeout(() => {
          const result = [{ transcript: "I'm visiting for a wedding. I'd love a relaxed afternoon, with easy walking, something creative, and time for a coffee." }];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
          this.onend?.();
        }, 10000);
      }, 100);
    }
    stop() { clearTimeout(this.timer); this.onend?.(); }
    abort() { clearTimeout(this.timer); }
  }
  window.SpeechRecognition = PreviewRecognition;
  window.webkitSpeechRecognition = PreviewRecognition;
});
const page = await context.newPage();
page.setDefaultTimeout(18000);
page.on("pageerror", error => evidence.errors.push(error.message));
const videoFile = await page.video().path();
const recordingStart = Date.now();
const wants = id => !requested || requested.includes(id);
async function scroll(target, block = "center") {
  const locator = typeof target === "string" ? page.locator(target).first() : target;
  await locator.evaluate((element, position) => element.scrollIntoView({ behavior: "smooth", block: position }), block);
  await page.waitForTimeout(450);
}
async function chapter(id, work) {
  const definition = plan.find(scene => scene.id === id);
  console.log(`Recording ${id}`);
  const started = Date.now();
  const at = async seconds => {
    const wait = seconds * 1000 - (Date.now() - started);
    if (wait > 0) await page.waitForTimeout(wait);
  };
  await work(at);
  await at(definition.duration);
  const duration = (Date.now() - started) / 1000;
  manifest[id] = { file: videoFile, start: (started - recordingStart) / 1000, duration, playbackRate: duration / definition.duration };
  await page.screenshot({ path: `${out}/${id}.jpg` });
  writeFileSync(`${out}/captures.json`, JSON.stringify(manifest, null, 2));
  writeFileSync(`${out}/capture-evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(`Saved ${id}: ${duration.toFixed(1)}s`);
}
async function liveAction(action) {
  const responsePromise = page.waitForResponse(response =>
    response.url().includes("/api/agent/discover") && response.request().method() === "POST", { timeout: 65000 });
  await action();
  const response = await responsePromise;
  const text = await response.text();
  const events = text.trim().split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
  const error = events.find(event => event.type === "error");
  evidence.liveRequests.push({ status: response.status(), eventTypes: events.map(event => event.type), events });
  writeFileSync(`${out}/capture-evidence.json`, JSON.stringify(evidence, null, 2));
  if (!response.ok() || error) throw new Error(`Live Qloo request failed: ${JSON.stringify(error || { status: response.status() })}`);
  console.log(`Live Qloo request completed: ${events.map(event => event.type).join(", ")}`);
}
async function prepareDiscover() {
  await page.goto(`${base}/?explore=1`);
  await expect(page.locator(".form-panel")).toBeVisible();
  await page.locator("#city").fill("Brooklyn, New York");
  while (await page.getByRole("button", { name: /^Remove / }).count()) {
    await page.getByRole("button", { name: /^Remove / }).first().click();
  }
  for (const [interest, category] of [["Nina Simone", "Music"], ["The Grand Budapest Hotel", "Film"]]) {
    await page.getByRole("combobox", { name: "Category for new anchor" }).selectOption(category);
    await page.locator("#anchor-input").fill(interest);
    await page.locator("#anchor-input").press("Enter");
  }
  await page.locator(".friendly-advanced > summary").click();
  await page.locator("#budget").selectOption("Free or low-cost");
  await page.locator("#movement").selectOption("Easy walking");
  await page.locator(".personal-considerations summary").click();
  await page.getByRole("combobox", { name: "Personal considerations", exact: true }).selectOption("custom");
  await page.locator(".friendly-brief textarea").fill("");
  await page.locator(".friendly-advanced > summary").click();
  await scroll(".friendly-brief");
}

try {
  if (wants("02-your-day") || wants("03-open-a-door") || wants("04-make-a-plan")) {
    await prepareDiscover();
    if (wants("02-your-day")) await chapter("02-your-day", async at => {
      await at(2);
      await page.locator(".friendly-advanced > summary").click();
      await scroll(".friendly-advanced");
      await at(7);
      await page.locator(".friendly-advanced > summary").click();
      await scroll(".friendly-brief");
      await at(9);
      await page.getByRole("button", { name: "Use my voice", exact: true }).click();
      await expect(page.locator(".friendly-brief textarea")).toHaveValue(/visiting for a wedding/, { timeout: 18000 });
      await at(23);
      await scroll(page.getByRole("button", { name: "Explore with Qloo", exact: true }));
    });
    else await page.locator(".friendly-brief textarea").fill("A relaxed wedding-weekend afternoon with easy walking and time for coffee.");

    const discover = () => liveAction(() => page.getByRole("button", { name: "Explore with Qloo", exact: true }).click());
    if (wants("03-open-a-door")) await chapter("03-open-a-door", async at => {
      await at(1);
      await discover();
      await expect(page.locator(".door-card").first()).toBeVisible({ timeout: 60000 });
      await scroll("#journey-result", "start");
      await at(8);
      await page.locator(".door-preview").first().click();
      await scroll(".door-card.is-expanded .door-result-expanded", "start");
      await at(14);
      await page.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
      await scroll(".hidden-gem-content");
      await at(21);
      const provenance = page.locator("summary").filter({ hasText: /retrieved cultural graph/i }).first();
      if (await provenance.count()) { await provenance.click(); await scroll(provenance); await at(24); await provenance.click(); }
      await scroll("details.friendly-connection", "start");
      await page.locator("details.friendly-connection > summary").first().click();
      await at(28);
      await page.locator("details.friendly-connection > summary").first().click();
    });
    else { await discover(); await page.locator(".door-preview").first().click(); }

    if (wants("04-make-a-plan")) {
      await scroll(".door-card.is-expanded .door-result-expanded", "start");
      await chapter("04-make-a-plan", async at => {
        const map = page.locator(".door-map-link").first();
        if (!(await map.getAttribute("href")).startsWith("https://www.google.com/maps/search/")) throw new Error("Maps link is not a real category search.");
        await at(1); await map.hover();
        const save = page.locator(".door-card.is-expanded").getByRole("button", { name: /^Save / });
        await save.click();
        evidence.guestSave = true;
        await at(4);
        await page.getByRole("button", { name: "Plan these ideas", exact: true }).click();
        await scroll("#day-plan", "start");
        await at(7);
        await page.getByRole("button", { name: "Suggest a plan that fits", exact: true }).click();
        await expect(page.locator(".planner-item").first()).toBeVisible();
        await at(11);
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download day plan", exact: true }).click();
        const file = await downloaded;
        if (!file.suggestedFilename().endsWith(".docx")) throw new Error("Expected a Word day-plan download.");
        await file.saveAs(`${out}/sample-day-plan.docx`);
        evidence.wordDownload = file.suggestedFilename();
        await at(16);
        await page.goto(`${base}/?view=saved`);
        await scroll(page.getByRole("heading", { name: "My Doors", exact: true }), "start");
      });
    }
  }
  if (wants("05-discovery-lab")) {
    await page.goto(`${base}/lab`);
    await page.getByLabel("Cultural interest", { exact: true }).fill("Nina Simone");
    await page.getByRole("button", { name: "Add anchor", exact: true }).click();
    await page.getByRole("combobox", { name: "Category for Nina Simone", exact: true }).selectOption("Music");
    await liveAction(() => page.getByRole("button", { name: /^Start exploring/ }).click());
    await expect(page.locator(".lab-discovery").first()).toBeVisible();
    await scroll(".lab-direction", "start");
    await chapter("05-discovery-lab", async at => {
      await at(3);
      await scroll(".lab-map", "start");
      await at(7);
      await page.locator(".lab-direction").filter({ hasText: "Take the Wild Door" }).click();
      await at(9);
      await liveAction(() => page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click());
      await expect(page.locator(".lab-compare-branch")).toHaveCount(2, { timeout: 60000 });
      evidence.liveBranchComparison = true;
      await scroll(".lab-compare", "start");
      await at(20);
      const histories = page.locator(".lab-post-history");
      if (await histories.count()) await scroll(histories.first(), "start");
    });
  }
  if (wants("06-help-others")) {
    await page.goto(`${base}/?explore=1&audience=company#company-tools`);
    const tools = page.locator("#company-tools");
    if (await tools.evaluate(element => element.tagName === "DETAILS" && !element.open)) {
      await tools.locator(":scope > summary").click();
    }
    await scroll(tools, "start");
    await chapter("06-help-others", async at => {
      await at(3);
      await tools.locator("select").selectOption("celebrations");
      const inputs = tools.locator('input[type="text"], input:not([type])');
      await inputs.nth(0).fill("Brooklyn, New York");
      await inputs.nth(1).fill("Wedding weekend · time between celebrations");
      await at(11);
      await tools.getByText(/^Guest walkthrough · how the experience works$/).click();
      await scroll("#company-walkthrough", "start");
      await at(17);
      await tools.getByText(/^Guest walkthrough · how the experience works$/).click();
      await tools.getByRole("button", { name: /Copy guest link/i }).click();
      const guestLink = await tools.locator('a[href^="/companies/discover?"]').first().getAttribute("href");
      const query = new URL(guestLink, base).searchParams;
      if ([...query.keys()].some(key => !["type", "place", "occasion"].includes(key))) throw new Error("Unexpected private field in guest link.");
      evidence.guestLink = guestLink;
      await at(21);
      await tools.locator('a[href^="/companies/discover?"]').first().click();
      await expect(page.locator("#city")).toHaveValue("Brooklyn, New York");
      await scroll(".form-panel", "start");
    });
  }
  if (wants("07-partners")) {
    await page.goto(`${base}/partners`);
    await scroll(page.locator("h1").first(), "start");
    await chapter("07-partners", async at => {
      await at(6);
      await page.goto(`${base}/mockups`);
      await page.getByRole("tab", { name: "Destination weddings", exact: true }).click();
      await page.locator('[data-sponsor="YOUR Hotel"] button').click();
      await scroll("[data-guest-featured]", "start");
      await at(14);
      await page.locator('[data-sponsor="YOUR Dining"] button').click();
      await scroll("[data-guest-featured]", "start");
      await at(18);
      await page.getByRole("button", { name: "See partner details", exact: true }).click();
      await at(22);
      await page.getByRole("link", { name: "Discuss this partnership", exact: true }).click();
      await expect(page.locator("form").first()).toBeVisible();
    });
  }
  if (evidence.errors.length) throw new Error(`Browser errors: ${evidence.errors.join("; ")}`);
  console.log("Capture completed with real application interactions and live Qloo evidence.");
} finally {
  writeFileSync(`${out}/capture-evidence.json`, JSON.stringify(evidence, null, 2));
  await context.close();
  await browser.close();
}
