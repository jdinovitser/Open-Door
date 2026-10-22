import { expect, test, type Page } from "@playwright/test";

test("demo gems are keyboard-revealed, tied to each door category, repeatable, and reduced-motion friendly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await page.getByRole("radio", { name: "Surprise me" }).check();
  await page.getByRole("button", { name: "Find my doors", exact: true }).click();

  const cards = page.locator(".door-card");
  const firstCard = cards.nth(0);
  const secondCard = cards.nth(1);
  await firstCard.locator(".door-preview").click();
  const firstTitle = await firstCard.locator(".door-result-expanded h4").innerText();
  const firstCategory = (await firstCard.locator(".door-kind").innerText()).split(" · ")[1];
  const firstToggle = firstCard.getByRole("button", { name: "Uncover a hidden gem", exact: true });
  await firstToggle.focus();
  await page.keyboard.press("Enter");
  const firstGem = firstCard.getByRole("region", { name: `Hidden gem for ${firstTitle}` });
  await expect(firstGem).toBeVisible();
  await expect(firstGem).toContainText(firstTitle);
  await expect(firstGem).toContainText(new RegExp(firstCategory, "i"));
  await expect(firstGem).toContainText("Demo activity");
  const firstPrompt = await firstGem.locator("p").first().innerText();
  const guideUrl = await firstGem.getByRole("link").getAttribute("href");
  expect(guideUrl).toContain(encodeURIComponent(firstTitle));
  expect(guideUrl).toContain(encodeURIComponent(firstCategory));
  await expect(firstGem.getByRole("link")).toHaveAttribute("target", "_blank");
  await expect(firstGem.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  expect(await firstGem.locator(".hidden-gem-art img").evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain("curiosity-guide-still.webp");

  await firstCard.getByRole("button", { name: "Close hidden gem" }).click();
  await expect(firstGem).toBeHidden();
  await firstCard.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
  await expect(firstGem.locator("p").first()).toHaveText(firstPrompt);

  await secondCard.locator(".door-preview").click();
  const secondTitle = await secondCard.locator(".door-result-expanded h4").innerText();
  const secondCategory = (await secondCard.locator(".door-kind").innerText()).split(" · ")[1];
  await secondCard.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
  const secondGem = secondCard.getByRole("region", { name: `Hidden gem for ${secondTitle}` });
  await expect(secondGem).toContainText(secondTitle);
  await expect(secondGem).toContainText(new RegExp(secondCategory, "i"));
  expect(secondCategory).not.toBe(firstCategory);
  expect(await secondGem.locator("p").first().innerText()).not.toBe(firstPrompt);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileNav = page.getByRole("navigation", { name: "Main navigation" });
  expect(await mobileNav.evaluate(nav => getComputedStyle(nav).display)).toBe("grid");
  expect(await mobileNav.locator(".nav-btn").first().evaluate(button => getComputedStyle(button).fontSize)).toBe("12px");
  for (const button of await mobileNav.locator(".nav-btn").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThan(80);
    expect(box!.height).toBeGreaterThanOrEqual(40);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  const signInBox = await page.getByRole("link", { name: "Sign in", exact: true }).boundingBox();
  const soundBox = await page.getByRole("button", { name: "Sound effects: off" }).boundingBox();
  expect(signInBox!.x + signInBox!.width).toBeLessThanOrEqual(soundBox!.x);
  await expect(secondGem.getByRole("link")).toBeVisible();
  await page.screenshot({ path: "generated-artifacts/hidden-gem-tests/demo-mobile.png" });
});

function liveResult(input: any) {
  return JSON.stringify({ type: "complete", journey: {
    mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
    context: input.context, anchors: input.anchors.map((item: any) => item.label),
    categories: Object.fromEntries(input.anchors.map((item: any) => [item.label, item.category])),
    iteration: input.iteration || 0, resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] },
    doors: [{ id: "qloo-hidden-gem-fixture", entityId: "fixture-entity", entityType: "artist",
      tier: "Familiar", title: "A returned listening artist", kind: "Music", category: "Music",
      source: input.anchors[0].label, why: "A mocked returned connection.", whyNow: "Listen to a short excerpt.",
      evidence: "Mock Qloo retrieval for browser verification.", thread: "Listen closely" }],
  } }) + "\n";
}

test("live hidden gems clearly remain editorial prompts, not Qloo evidence or venue claims", async ({ page }) => {
  await page.route("**/api/status", async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), qlooConfigured: true } });
  });
  let requestCount = 0;
  await page.route("**/api/agent/discover", async route => {
    requestCount++;
    await route.fulfill({ contentType: "application/x-ndjson", body: liveResult(route.request().postDataJSON()) });
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  const card = page.locator(".door-card").first();
  await expect(card.locator("h3")).toHaveText("A returned listening artist");
  await expect(page.locator(".result-truth-note")).toContainText("Recommendations from Qloo");
  await card.locator(".door-preview").click();
  await card.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
  const gem = card.getByRole("region", { name: "Hidden gem for A returned listening artist" });
  await expect(gem).toContainText("Suggested activity");
  await expect(gem).toContainText("not a verified place or event");
  await expect(gem.getByRole("link")).toHaveAttribute("href", /google\.com\/search\?q=/);
  expect(requestCount).toBe(1);
});
