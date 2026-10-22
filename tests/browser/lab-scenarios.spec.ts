import { test, expect } from "@playwright/test";

const scenarios = [
  ["personal-style", "Personal Style"],
  ["age-aware", "Age-Aware"],
  ["wellbeing", "Health & Wellbeing"],
  ["custom", "Custom / Anything Else"],
];
for (const [id, label] of scenarios) {
  test(`${label} loads, edits, explores and restores inside the existing Lab`, async ({ page }) => {
    await page.goto("/lab");
    await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
    const selector = page.getByRole("combobox", { name: "Lab scenario", exact: true });
    await expect(selector.getByRole("option", { name: label, exact: true })).toHaveCount(1);
    await selector.selectOption(id);
    const scenario = page.getByRole("textbox", { name: "Your scenario", exact: true });
    await expect(scenario).not.toHaveValue("");
    const edited = `${label}: I want a quiet, seated option with limited time and a small budget.`;
    await scenario.fill(edited);
    await page.getByLabel("Cultural interest", { exact: true }).fill("jazz");
    await page.getByRole("button", { name: "Add anchor", exact: true }).click();
    await page.getByRole("button", { name: /^Start exploring/ }).click();
    await expect(scenario).toHaveValue(edited);
    page.once("dialog", dialog => dialog.accept(label));
    await page.getByRole("button", { name: "Save checkpoint", exact: true }).click();
    await page.locator(".lab-direction").filter({ hasText: "Stay in Your World" }).click();
    await page.locator(".lab-door-detail").getByRole("button", { name: /^Open this door/ }).click();
    await expect(page.locator(".lab-discovery")).toHaveCount(3);
    await expect(page.locator(".lab-discovery").first()).toContainText("silent reading");
    await page.locator(".lab-discovery").first().getByRole("button", { name: "Tell me more", exact: true }).click();
    await expect(page.locator(".lab-discovery").first()).toContainText("seated or at-home");
    await page.reload();
    await expect(selector).toHaveValue(id);
    await expect(scenario).toHaveValue(edited);
    await scenario.fill("A different goal.");
    await page.getByRole("button", { name: "Return here", exact: true }).first().click();
    await expect(scenario).toHaveValue(edited);
  });
}

test("custom text works without a preset and all existing discovery directions remain", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await page.getByRole("textbox", { name: "Your scenario", exact: true }).fill("Explore independently at my own pace.");
  await page.getByLabel("Cultural interest", { exact: true }).fill("books");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("button", { name: /^Start exploring/ }).click();
  await expect(page.getByRole("textbox", { name: "Your scenario", exact: true })).toHaveValue("Explore independently at my own pace.");
  await expect(page.locator(".lab-direction")).toHaveCount(6);
  await expect(page.getByRole("combobox", { name: "Adventure", exact: true })).toBeVisible();
});
