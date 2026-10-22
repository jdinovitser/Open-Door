import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("story uses the new mascot and downloads a portable PNG on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  const story = page.locator(".story-card");
  await expect(story.locator("img")).toHaveAttribute("src", /door-mascot-appear-still\.webp/);
  const downloadEvent = page.waitForEvent("download");
  await story.getByRole("button", { name: "Download story card" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("my-open-door-story.png");
  const file = await download.path();
  const bytes = await readFile(file!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  await download.saveAs("generated-artifacts/updated-story-card.png");
  await story.screenshot({ path: "generated-artifacts/story-card-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("native sharing includes the new illustrated PNG with the story", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      (window as unknown as { shared: unknown }).shared = {
        text: data.text, name: data.files?.[0]?.name, type: data.files?.[0]?.type,
        size: data.files?.[0]?.size,
      };
    } });
  });
  await page.goto("/demo");
  await page.locator(".story-card").getByRole("button", { name: "Share / copy story" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: unknown }).shared)).toMatchObject({
    name: "my-open-door-story.png", type: "image/png",
  });
});

test("clipboard receives both the new card image and text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        (window as unknown as { copiedTypes: string[] }).copiedTypes = items[0].types;
      },
    } });
  });
  await page.goto("/demo");
  await page.locator(".story-card").getByRole("button", { name: "Share / copy story" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { copiedTypes?: string[] }).copiedTypes)).toEqual(["image/png", "text/plain"]);
  await expect(page.getByText("Story card and text copied", { exact: true })).toBeVisible();
});

test("unsupported image copying falls back visibly to story text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      write: async () => { throw new Error("Image clipboard unsupported"); },
      writeText: async (text: string) => { (window as unknown as { copiedText: string }).copiedText = text; },
    } });
  });
  await page.goto("/demo");
  await page.locator(".story-card").getByRole("button", { name: "Share / copy story" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { copiedText?: string }).copiedText)).toContain("My Open Door");
  await expect(page.getByText("Image sharing unavailable. Story text copied; use Download story card for the image.", { exact: true })).toBeVisible();
});
