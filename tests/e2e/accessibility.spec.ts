import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetDatabase } from "./support/db";
import { resetMocks, signIn } from "./support/mocks";
import { addToCart, fillDelivery, placeOrderButton } from "./support/shop";

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
});

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`),
    `axe found problems on ${label}`,
  ).toEqual([]);
}

test.describe("with reduced motion", () => {
  // The hero's one-off "dye" animation fades its text in; check the settled page.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("pages pass an automated WCAG 2.2 AA check", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    for (const path of ["/", "/shop", "/shop?category=scarves", "/products/olosupa-moon-cloth", "/signin?returnTo=%2Fcheckout"]) {
      await page.goto(path);
      await expectNoSeriousViolations(page, path);
    }

    await addToCart(page, "olosupa-moon-cloth", 2);
    await page.goto("/cart");
    await expectNoSeriousViolations(page, "/cart");

    await signIn(page, "amina", "/checkout");
    await expectNoSeriousViolations(page, "/checkout");
    await page.getByLabel("Full name").fill("");
    await placeOrderButton(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expectNoSeriousViolations(page, "/checkout with errors");

    await fillDelivery(page);
    await placeOrderButton(page).click();
    await page.waitForURL(/\/orders\//);
    await expectNoSeriousViolations(page, "order confirmation");
    await page.goto("/account");
    await expectNoSeriousViolations(page, "/account");

    expect(errors).toEqual([]);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the menu opens, closes with Escape and navigates", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();

    await menu.click();
    await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "Scarves" }).click();
    await expect(page).toHaveURL("/shop?category=scarves");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scarves");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("nothing overflows sideways", async ({ page }) => {
    for (const path of ["/", "/shop", "/products/ibadandun-panel-cloth", "/signin"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
