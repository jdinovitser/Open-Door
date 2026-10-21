import { expect, test } from "@playwright/test";

test("the complete music and art journey stays readable and useful through repeated exploration and saving", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("combobox", { name: "Personal considerations", exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill("I love music and art");
  await page.getByRole("button", { name: "Find my doors", exact: true }).click();
  await expect(page.locator(".door-card h3").first()).toHaveText("Make a three-song playlist");
  await page.locator(".door-card").first().locator(".door-preview").click();
  const seen = new Set<string>();
  for (let step = 0; step < 5; step++) {
    const expanded = page.locator(".door-card.is-expanded");
    await expect(expanded).toBeVisible();
    const title = await expanded.locator("h4").innerText();
    expect(seen.has(title)).toBe(false);
    seen.add(title);
    await expect(expanded).toContainText("music and art");
    await expect(expanded.getByRole("heading", { name: "Try this first" })).toBeVisible();
    const text = await expanded.innerText();
    expect(text).not.toMatch(/authored|deterministic|cultural direction|guided sample|modest step|· step \d|→/i);
    const map = expanded.locator(".door-map-link");
    await expect(map).toContainText("Opens Google Maps");
    expect(await map.getAttribute("href")).not.toMatch(/nearby%20(?:Books|Experiences)/);
    if (step < 4) {
      await expanded.getByRole("button", { name: "Explore more ideas", exact: true }).click();
      await expect(page.getByRole("region", { name: "Thread exploration" })).toContainText(title);
    }
  }
  await page.getByRole("button", { name: "Uncover a hidden gem", exact: true }).click();
  await expect(page.locator(".hidden-gem-content:visible")).toBeVisible();
  const title = await page.locator(".door-card.is-expanded h4").innerText();
  await page.getByRole("button", { name: `Save ${title}`, exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /My Doors/ }).click();
  await expect(page.locator(".saved-row")).toContainText(title);
  await page.screenshot({ path: "generated-artifacts/plain-language-saved-journey.png" });
});
