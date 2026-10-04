import { expect, test } from "@playwright/test";

/**
 * The second app server (port 3101) runs without DATABASE_URL, which is what a
 * host shows when the variable wasn't added, or was added without redeploying.
 */
const BROKEN = "http://localhost:3101";

test.describe("when DATABASE_URL is missing", () => {
  test("pages that don't need the database still work", async ({ page }) => {
    const response = await page.goto(`${BROKEN}/signin`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible();
  });

  test("pages that need it show the shop's own error page, with a pointer for the owner", async ({ page }) => {
    await page.goto(`${BROKEN}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn't load");
    await expect(page.getByRole("link", { name: "Open the setup check" })).toHaveAttribute("href", "/api/health");
    await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible();
  });

  test("the setup check says exactly what to fix", async ({ request }) => {
    const response = await request.get(`${BROKEN}/api/health`);
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      database: "DATABASE_URL is not set",
      appUrl: "http://localhost:3101 (matches this site)",
      email: "configured",
      bankTransfer: "offered",
    });
    expect(body.toFix).toEqual([expect.stringContaining("trigger a new deploy")]);
  });

  test("unknown pages get a real 404 page and robots.txt is served", async ({ page, request }) => {
    expect((await page.goto(`${BROKEN}/nothing-here`))?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    const robots = await request.get(`${BROKEN}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Disallow: /checkout");
  });
});
