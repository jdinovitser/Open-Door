import { test, expect } from "@playwright/test";

async function editPlan(page: import("@playwright/test").Page) {
  const setup = page.locator(".lab-start-advanced");
  if (await setup.isVisible() && !await setup.evaluate(node => node.hasAttribute("open"))) await setup.locator(":scope > summary").click();
  const plan = page.locator(".lab-edit-plan");
  if (await plan.isVisible() && !await plan.evaluate(node => node.hasAttribute("open"))) await plan.locator(":scope > summary").click();
}

const scenarios = [
  ["personal-style", "Personal Style"],
  ["age-aware", "Age-Aware"],
  ["wellbeing", "Health & Wellbeing"],
  ["custom", "Custom / Anything Else"],
];
for (const [id, label] of scenarios) {
  test(`${label} loads, edits, explores and restores inside the existing Lab`, async ({ page }) => {
    await page.goto("/lab");
    await page.locator(".friendly-connection > summary").click();
    await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
    await editPlan(page);
    const selector = page.getByRole("combobox", { name: "Style, age, wellbeing & other needs", exact: true });
    await expect(selector.getByRole("option", { name: label, exact: true })).toHaveCount(1);
    await selector.selectOption(id);
    const scenario = page.locator(".friendly-brief textarea");
    await expect(scenario).not.toHaveValue("");
    const edited = `${label}: I want a quiet, seated option with limited time and a small budget.`;
    await scenario.fill(edited);
    await page.getByLabel("Cultural interest", { exact: true }).fill("jazz");
    await page.getByRole("button", { name: "Add anchor", exact: true }).click();
    await page.getByRole("button", { name: /^Start exploring/ }).click();
    await expect(page.locator(".lab-edit-plan")).toBeVisible();
    await editPlan(page);
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
    await expect(page.locator(".lab-edit-plan")).toBeVisible();
    await editPlan(page);
    await expect(selector).toHaveValue(id);
    await expect(scenario).toHaveValue(edited);
    await scenario.fill("A different goal.");
    await page.getByRole("button", { name: "Return here", exact: true }).first().click();
    await expect(scenario).toHaveValue(edited);
  });
}

test("custom text works without a preset and all existing discovery directions remain", async ({ page }) => {
  await page.goto("/lab");
  await page.locator(".friendly-connection > summary").click();
  await page.getByRole("button", { name: "Try prepared examples", exact: true }).click();
  await page.locator(".friendly-brief textarea").fill("Explore independently at my own pace.");
  await page.getByLabel("Cultural interest", { exact: true }).fill("books");
  await page.getByRole("button", { name: "Add anchor", exact: true }).click();
  await page.getByRole("button", { name: /^Start exploring/ }).click();
  await editPlan(page);
  await expect(page.locator(".friendly-brief textarea")).toHaveValue("Explore independently at my own pace.");
  await expect(page.locator(".lab-direction")).toHaveCount(6);
  await expect(page.getByRole("combobox", { name: "Adventure", exact: true })).toBeVisible();
});
