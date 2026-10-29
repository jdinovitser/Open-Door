import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";

async function openSample(page: import("@playwright/test").Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Find my doors", exact: true }).click();
  await expect(page.locator(".door-card h3").first()).toBeVisible();
}

test("recommendations download as a genuine Word document with clickable map links", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printRequested = "true"; };
  });
  await openSample(page);
  const result = page.locator(".door-card").first();
  await result.locator(".door-preview").click();
  await expect(result.locator(".door-map-link")).toHaveCount(0);
  await expect(result).toContainText("No visitable location is confirmed");
  await page.getByRole("button", { name: "Print recommendations" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "true");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".recommendations-print")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Word document" }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).toBeTruthy();
  expect(download.suggestedFilename()).toBe("open-door-recommendations.docx");
  expect((await readFile(file!)).subarray(0, 2).toString()).toBe("PK");
  const xml = execFileSync("unzip", ["-p", file!, "word/document.xml"], { encoding: "utf8" });
  expect(xml).toContain("Demo recommendations are examples");
  expect(xml).toContain("Why you might like it:");
  expect(xml).toContain("Try this:");
  const links = execFileSync("unzip", ["-p", file!, "word/_rels/document.xml.rels"], { encoding: "utf8" });
  expect(links).toContain("https://www.google.com/maps/search/");
  expect(links).toContain('TargetMode="External"');
  await download.saveAs("generated-artifacts/recommendations-sample.docx");
});

test("local planner uses returned candidates, enforces its time window, and exports a truthful plan", async ({ page }) => {
  await openSample(page);
  await page.getByRole("button", { name: "Plan these ideas" }).click();
  const firstCandidate = page.locator(".planner-pick").first();
  const candidateTitle = (await firstCandidate.innerText()).split("\n")[0];
  await firstCandidate.click();
  const duration = page.getByRole("combobox", { name: `Duration for ${candidateTitle}` });
  await duration.selectOption("120");
  await page.getByLabel("End", { exact: true }).fill("11:00");
  await expect(page.getByRole("alert")).toContainText("does not fit");
  await expect(page.getByRole("button", { name: "Download day plan" })).toBeDisabled();
  await duration.selectOption("45");
  await expect(page.getByRole("button", { name: "Download day plan" })).toBeEnabled();
  const map = page.getByRole("link", { name: /Find .* on Google Maps/ }).first();
  await expect(map).toHaveAttribute("target", "_blank");
  await expect(map).toHaveAttribute("rel", "noopener noreferrer");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download day plan" }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(download.suggestedFilename()).toBe("open-door-day-plan.docx");
  const xml = execFileSync("unzip", ["-p", file!, "word/document.xml"], { encoding: "utf8" });
  expect(xml).toContain("A flexible day plan");
  expect(xml).toContain("Travel time is not included.");
  expect(xml).toContain("Demo recommendations are examples");
  expect(xml).toContain(candidateTitle);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const id of ["planner-start", "planner-end", "planner-location", "planner-buffer"]) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
});

test("Word exports preserve Unicode and escape untrusted text rather than exporting HTML", async ({ page }) => {
  await page.goto("/");
  const downloading = page.waitForEvent("download");
  await page.evaluate(async () => {
    const modulePath = "/src/documentExport.ts";
    const { downloadWordDocument } = await import(/* @vite-ignore */ modulePath);
    await downloadWordDocument({
      filename: "unicode-test.docx", title: "Café — 音楽 & música",
      subtitle: "A readable document",
      sections: [{ heading: "<script>not executable</script>", paragraphs: ["Crème brûlée & storytelling"] }],
      footnote: "A test export.",
    });
  });
  const file = await (await downloading).path();
  const xml = execFileSync("unzip", ["-p", file!, "word/document.xml"], { encoding: "utf8" });
  expect(xml).toContain("Café — 音楽 &amp; música");
  expect(xml).toContain("&lt;script&gt;not executable&lt;/script&gt;");
  expect(xml).toContain("Crème brûlée &amp; storytelling");
});

test("suggested schedule fits, supports checkoff and reorder, and prints only the chosen sheet", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => {}; });
  await openSample(page);
  await page.getByRole("button", { name: "Suggest a plan that fits" }).click();
  const items = page.locator(".planner-item");
  await expect(items).toHaveCount(3);
  const first = await items.first().locator(".planner-check span").innerText();
  const last = await items.last().locator(".planner-check span").innerText();
  await items.last().getByRole("button", { name: /earlier/ }).click();
  await expect(items.nth(1).locator(".planner-check span")).toHaveText(last);
  await items.first().getByRole("checkbox").check();
  await expect(items.first().getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "I have one hour", exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first().getByRole("button", { name: /later/ })).toBeDisabled();
  await page.getByRole("button", { name: "Show all ideas" }).click();
  await expect(items).toHaveCount(3);
  await expect(items.first().locator(".planner-check span")).toHaveText(first);
  await page.getByRole("button", { name: "Print day plan", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".day-plan-print")).toBeVisible();
  await expect(page.locator(".recommendations-print")).toBeHidden();
  await expect(page.locator(".day-plan-print")).toContainText("completed");
  await page.pdf({ path: "generated-artifacts/day-plan-print.pdf", format: "A4" });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Print recommendations", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".recommendations-print")).toBeVisible();
  await expect(page.locator(".day-plan-print")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.locator("#day-plan").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/planner-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator("#day-plan").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "generated-artifacts/planner-mobile.png" });
});

test("account preference memory restores safely and only writes after an explicit choice", async ({ page }) => {
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/account/preferences", async route => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ json: { revision: 3, preferences: {
        intent: "Go deeper", depth: "Surprise me", budget: "Moderate", movement: "Easy walking",
      } } });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push({ method, body });
    await route.fulfill({ json: { revision: method === "DELETE" ? 4 : 3, preferences: null } });
  });
  await mountPreferenceMemory(page);
  await expect.poll(() => page.locator("body").getAttribute("data-applied")).toContain('"intent":"Go deeper"');
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Save these four settings" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved to your account.");
  expect(writes[0]).toEqual({
    method: "PUT",
    body: {
      preferences: { intent: "Try something new", depth: "A little further", budget: "Flexible", movement: "Mostly seated" },
      revision: 3,
    },
  });
  await page.getByRole("button", { name: "Forget saved settings" }).click();
  await expect(page.getByRole("status")).toContainText("Saved preferences forgotten.");
  expect(writes[1]).toEqual({ method: "DELETE", body: { revision: 3 } });
});

test("a stale preference revision prompts one explicit write and reloads account state", async ({ page }) => {
  let reads = 0;
  let writes = 0;
  await page.route("**/api/account/preferences", async route => {
    if (route.request().method() === "GET") {
      reads += 1;
      await route.fulfill({ json: {
        revision: reads === 1 ? 2 : 5,
        preferences: { intent: reads === 1 ? "Go deeper" : "Find my people", depth: "Close to home", budget: "Flexible", movement: "Mostly seated" },
      } });
      return;
    }
    writes += 1;
    await route.fulfill({ status: 409, json: { message: "The account changed elsewhere." } });
  });
  await mountPreferenceMemory(page);
  await page.getByRole("button", { name: "Save these four settings" }).click();
  await expect.poll(() => page.locator("body").getAttribute("data-applied")).toContain('"intent":"Find my people"');
  expect(reads).toBe(2);
  expect(writes).toBe(1);
  expect(await page.locator("body").getAttribute("data-stale")).toBe("true");
});

async function mountPreferenceMemory(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const reactModule = await import(/* @vite-ignore */ reactPath);
    const React = reactModule.default || reactModule;
    const domModule = await import(/* @vite-ignore */ domPath);
    const { createRoot } = domModule.default || domModule;
    const { default: PreferencesMemory } = await import(/* @vite-ignore */ "/src/PreferencesMemory.tsx");
    const app = document.getElementById("root");
    if (app) app.style.display = "none";
    const host = document.createElement("main");
    host.id = "preferences-component-test";
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(PreferencesMemory, {
      userId: "clerk_test_user", signedIn: true,
      values: { intent: "Try something new", depth: "A little further", budget: "Flexible", movement: "Mostly seated" },
      hasJourney: false, demoActive: false,
      onApply: (value: unknown) => { document.body.dataset.applied = JSON.stringify(value); },
      onRevisionChanged: () => { document.body.dataset.stale = "true"; },
    }));
  });
  await expect(page.getByRole("heading", { name: "Your discovery preferences" })).toBeVisible();
}
