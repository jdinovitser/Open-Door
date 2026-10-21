import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    soundMetrics: { contexts: number; tones: number; noises: number };
  }
}

async function measureSound(page: Page) {
  await page.addInitScript(() => {
    window.soundMetrics = { contexts: 0, tones: 0, noises: 0 };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.soundMetrics.contexts++;
      }
      createOscillator() {
        window.soundMetrics.tones++;
        return super.createOscillator();
      }
      createBufferSource() {
        window.soundMetrics.noises++;
        return super.createBufferSource();
      }
    };
  });
}

test("sound is opt-in, gives a happy start cue, persists and stops when muted", async ({ page }) => {
  await measureSound(page);
  await page.goto("/lab");
  await expect(page.getByRole("button", { name: "Sound effects: off" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.soundMetrics.contexts)).toBe(0);
  await page.getByRole("button", { name: "Sound effects: off" }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(4);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.sound.enabled"))).toBe("true");
  await page.getByLabel("Cultural interest", { exact: true }).fill("jazz");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(5);
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(9);
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound effects: on" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.soundMetrics.contexts)).toBe(0);
  await page.getByRole("button", { name: "Sound effects: on" }).click();
  await page.getByRole("button", { name: "My Doors", exact: true }).click();
  expect(await page.evaluate(() => window.soundMetrics.contexts)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.sound.enabled"))).toBe("false");
});

test("real door opening and mouse/keyboard closing synthesize distinct effects", async ({ page }) => {
  await measureSound(page);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Sound effects: off" }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(4);
  await page.getByRole("button", { name: /^Open familiar door:/ }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.noises)).toBe(1);
  await page.getByRole("button", { name: /^Collapse .* details$/ }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.noises)).toBe(2);
  await page.getByRole("button", { name: /^Open familiar door:/ }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.noises)).toBe(3);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.soundMetrics.noises)).toBe(4);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".door-card.is-expanded")).toHaveCount(0);
  expect(await page.evaluate(() => window.soundMetrics.tones)).toBe(10);
});

test("the clickable illustrated door plays one opening effect and keeps the mute preference", async ({ page }) => {
  await measureSound(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sound effects: off" }).click();
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(4);
  const door = page.getByRole("button", { name: "Open the illustrated door", exact: true });
  await door.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.soundMetrics.noises)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.soundMetrics.tones)).toBe(6);
  await expect(page.getByTestId("doorway-animation-image")).toBeVisible();
  await page.getByRole("button", { name: "Sound effects: on" }).click();
  await page.getByRole("button", { name: "Pause welcome illustration" }).click();
  await page.getByRole("button", { name: "Play welcome illustration" }).click();
  expect(await page.evaluate(() => window.soundMetrics.noises)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("opendoor.sound.enabled"))).toBe("false");
});

test("mobile navigation and sound remain accessible without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/lab");
  await expect(page.getByRole("button", { name: "Sound effects: off" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Sound effects: off" }).click();
  await expect(page.getByRole("button", { name: "Sound effects: on" })).toBeVisible();
});
