import { expect, test } from "@playwright/test";

test("all crawlers are disallowed and public pages and PDFs carry indexing restrictions", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");

  for (const path of ["/", "/judges", "/lab", "/partners", "/Open-Door-Judges-Guide.pdf", "/api/status"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    // A hosting proxy may append its own restrictions to the app's header.
    const directives = response.headers()["x-robots-tag"]?.split(",").map(value => value.trim());
    expect(directives, path).toEqual(expect.arrayContaining(["noindex", "nofollow", "noarchive", "nosnippet", "noimageindex"]));
  }

  await page.goto("/judges");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  await expect(page.getByRole("heading", { name: "Judge’s Guide", exact: true })).toBeVisible();
});
