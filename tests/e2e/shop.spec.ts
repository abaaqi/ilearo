import { expect, test } from "@playwright/test";
import { resetDatabase, sql } from "./support/db";
import { resetMocks } from "./support/mocks";
import { addToCart, cartLink, expectCartCount } from "./support/shop";

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
});

test("home page leads with the cloth and real products", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Adire, dyed by hand in Abeokuta");
  const featured = page.getByRole("region", { name: "A few to start with" }).getByRole("article");
  await expect(featured).toHaveCount(4);
  await expect(featured.first()).toContainText("Olosupa moon cloth");
  await expect(featured.first()).toContainText("₦24,000");
  await expect(page.getByRole("heading", { name: "Three ways to keep the dye out" })).toBeVisible();
  await expectCartCount(page, 0);
});

test("the shop lists and filters products from the database", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByText("14 pieces")).toBeVisible();

  await page.getByRole("navigation", { name: "Type" }).getByRole("link", { name: "Cloth" }).click();
  await expect(page).toHaveURL(/category=cloth/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cloth");
  await expect(page.getByText("6 pieces")).toBeVisible();

  await page.getByRole("navigation", { name: "Technique" }).getByRole("link", { name: "Oniko" }).click();
  await expect(page).toHaveURL(/category=cloth&technique=oniko/);
  await expect(page.getByText("2 pieces")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Technique" }).getByRole("link", { name: "Oniko" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // A product taken off the shop disappears from listings and its page.
  await sql`update products set active = false where slug = 'seed-pod-cloth'`;
  await page.reload();
  await expect(page.getByText("1 piece", { exact: true })).toBeVisible();
  const response = await page.goto("/products/seed-pod-cloth");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("product pages show stock and sold-out pieces can't be added", async ({ page }) => {
  await page.goto("/products/oniko-bucket-hat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Oniko bucket hat");
  await expect(page.getByText("Only 3 left")).toBeVisible();
  await expect(page.getByLabel("Quantity").locator("option")).toHaveCount(3);
  await expect(page.getByRole("img", { name: /seed|rings/i })).toBeVisible();

  await page.goto("/products/night-indigo-wrapper");
  await expect(page.getByText(/Sold out\. We dye in small batches/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
});

test("a guest can fill, change and empty a cart that persists", async ({ page }) => {
  await addToCart(page, "ibadandun-panel-cloth", 2);
  await expectCartCount(page, 2);
  await addToCart(page, "oniko-bucket-hat", 3);
  await expectCartCount(page, 5);

  // Only 3 hats exist, so a fourth is refused.
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status")).toHaveText("You already have all 3 we have in your cart.");

  // The cart lives in the database, keyed by a cookie, so it survives a reload.
  await page.reload();
  await cartLink(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your cart");
  await expect(page.getByText("Subtotal (5 items)")).toBeVisible();
  await expect(page.getByText("₦92,500")).toBeVisible();
  await expect(page.getByText("Add ₦7,500 more for free delivery.")).toBeVisible();

  await page.getByRole("button", { name: "One fewer Oniko bucket hat" }).click();
  await expect(page.getByLabel("Quantity of Oniko bucket hat")).toHaveText("2");
  await expectCartCount(page, 4);
  await expect(page.getByRole("button", { name: "One more Oniko bucket hat" })).toBeEnabled();

  await page.getByRole("button", { name: "Remove Ibadandun panel cloth" }).click();
  await expect(page.getByRole("link", { name: "Ibadandun panel cloth" })).toHaveCount(0);
  await expectCartCount(page, 2);

  const carts = await sql<{ userId: string | null; items: number }[]>`
    select c.user_id, coalesce(sum(ci.quantity), 0)::int as items
    from carts c left join cart_items ci on ci.cart_id = c.id group by c.id`;
  expect(carts).toEqual([{ userId: null, items: 2 }]);

  await page.getByRole("button", { name: "Remove Oniko bucket hat" }).click();
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});

test("the cart flags items that sold out after they were added", async ({ page }) => {
  await addToCart(page, "oniko-bucket-hat", 2);
  await sql`update products set stock = 1 where slug = 'oniko-bucket-hat'`;
  await page.goto("/cart");
  await expect(page.getByText("Only 1 left. Lower the quantity to check out.")).toBeVisible();
  await expect(page.getByText("Fix the items marked above to check out.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check out" })).toHaveCount(0);

  await page.getByRole("button", { name: "One fewer Oniko bucket hat" }).click();
  await expect(page.getByRole("link", { name: "Check out" })).toBeVisible();
});

test("the health check reports the database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true, database: "reachable", products: 14 });
});
