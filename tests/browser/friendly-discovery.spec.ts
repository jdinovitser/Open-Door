import { expect, test } from "@playwright/test";

test("Discover starts with a short form and includes a typed interest without an Add click", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.locator(".friendly-connection")).not.toHaveAttribute("open");
  const brief = page.locator(".friendly-brief textarea");
  await brief.fill("A relaxed afternoon with seated breaks and music.");
  await page.getByLabel("Place you’re exploring", { exact: true }).fill("Brooklyn");
  await page.locator("#anchor-input").fill("Nina Simone");
  await page.getByLabel("Category for new anchor", { exact: true }).selectOption("Music");
  await page.getByRole("button", { name: "Find my doors", exact: true }).click();
  await expect(page.locator(".journey-result")).toBeVisible();
  await expect(page.locator(".dna-items")).toContainText("Nina Simone");
  await expect(page.locator(".door-card")).toHaveCount(3);
  await expect(brief).toHaveValue("A relaxed afternoon with seated breaks and music.");
  await page.getByText("More ways to shape your outing", { exact: false }).first().click();
  await expect(page.getByLabel("Time and occasion", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Budget", { exact: true })).toBeVisible();
});

test("a pending live interest preserves its chosen category while private planning notes stay out of the request", async ({ page }) => {
  let input: any;
  await page.route("**/api/status", route => route.fulfill({ json: { qlooConfigured: true, sharedQlooConfigured: true } }));
  await page.route("**/api/agent/discover", route => {
    input = route.request().postDataJSON();
    return route.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ type: "complete", journey: {
      mode: "live", city: input.location, occasion: input.occasion, intent: input.intent, depth: input.depth,
      context: input.context, anchors: input.anchors.map((item: any) => item.label),
      categories: Object.fromEntries(input.anchors.map((item: any) => [item.label, item.category])),
      iteration: 0, resolvedAnchors: [], tools: [], notices: [], graph: { nodes: [], edges: [] }, doors: [],
    } }) + "\n" });
  });
  await page.goto("/companies/discover?type=hospitality");
  await page.locator(".friendly-brief textarea").fill("Private planning marker: I need quiet seated breaks.");
  await page.locator("#anchor-input").fill("Duke Ellington");
  await page.getByLabel("Category for new anchor", { exact: true }).selectOption("Music");
  await page.getByRole("button", { name: "Explore with Qloo", exact: true }).click();
  await expect(page.locator(".journey-result")).toBeVisible();
  expect(input.anchors).toContainEqual({ label: "Duke Ellington", category: "Music" });
  expect(JSON.stringify(input)).not.toContain("Private planning marker");
  await expect(page.locator(".friendly-brief textarea")).toHaveValue(/Private planning marker/);
});

test("Lab accepts a quick note and typed interest, then keeps scenario editing and branching available", async ({ page }) => {
  await page.goto("/lab");
  await page.locator(".friendly-connection > summary").click();
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await page.locator(".friendly-brief textarea").fill("I want a quiet music discovery with a friend.");
  await page.getByLabel("Cultural interest", { exact: true }).fill("Joni Mitchell");
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect(page.locator(".lab-discovery")).toHaveCount(3);
  await expect(page.locator(".lab-checkpoint")).toHaveCount(1);
  await page.locator(".lab-edit-plan > summary").click();
  await expect(page.locator(".friendly-brief textarea")).toHaveValue("I want a quiet music discovery with a friend.");
  await page.locator(".friendly-brief textarea").fill("A different plan, with time to rest.");
  await expect(page.getByRole("combobox", { name: "Style, age, wellbeing & other needs", exact: true })).toBeVisible();
  await expect(page.locator(".lab-direction")).toHaveCount(6);
  for (const href of ["#lab-results", "#lab-map", "#lab-comparison"]) {
    await expect(page.locator(`.lab-jump-links a[href="${href}"]`)).toHaveCount(1);
    await expect(page.locator(href)).toHaveCount(1);
  }
});

test("voice starts only after a click, appends editable text, and reports permission failures", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).voiceStarts = 0;
    class MockRecognition {
      onresult: any; onerror: any; onend: any;
      start() { (window as any).voiceStarts++; (window as any).voiceInstance = this; }
      stop() { this.onend?.(); }
      abort() { (window as any).voiceAborted = true; this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: MockRecognition });
  });
  await page.goto("/demo");
  const brief = page.locator(".friendly-brief textarea");
  await brief.fill("A day with a friend.");
  expect(await page.evaluate(() => (window as any).voiceStarts)).toBe(0);
  await page.getByRole("button", { name: "Use my voice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop voice input", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const voice = (window as any).voiceInstance;
    voice.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Some music and a quiet cafe." } }] });
    voice.onend();
  });
  await expect(brief).toHaveValue("A day with a friend. Some music and a quiet cafe.");
  await page.getByRole("button", { name: "Use my voice", exact: true }).click();
  await page.evaluate(() => (window as any).voiceInstance.onerror({ error: "not-allowed" }));
  await expect(page.locator(".friendly-brief-status")).toContainText("Microphone access wasn’t allowed");
  await expect(brief).toHaveValue("A day with a friend. Some music and a quiet cafe.");
  await page.getByRole("button", { name: "Use my voice", exact: true }).click();
  await brief.fill("Edited while listening.");
  expect(await page.evaluate(() => (window as any).voiceAborted)).toBe(true);
  await page.evaluate(() => (window as any).voiceInstance.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Late words" } }] }));
  await expect(brief).toHaveValue("Edited while listening.");
});

test("unsupported voice remains a useful mobile text form", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.locator(".friendly-brief")).toContainText("voice input isn’t supported");
  await page.locator(".friendly-brief textarea").fill("A quiet afternoon outdoors.");
  await expect(page.getByRole("button", { name: "Find my doors", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
