import { expect, test, type APIRequestContext } from "@playwright/test";
import { productBySlug, resetDatabase } from "./support/db";
import { resetMocks, signIn } from "./support/mocks";
import { LAGOS_DELIVERY, addToCart, expectCartCount } from "./support/shop";
import { appSignIn, bearer, newPhone, type AppSession } from "./support/app";

let phone: APIRequestContext;

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
  phone = await newPhone();
});

test.afterEach(async () => {
  await phone.dispose();
});

type FeedCart = { version: number; changedVia: string | null; itemCount: number; lines: { name: string; quantity: number }[] };

async function cartVersion(app: AppSession): Promise<number> {
  return (await (await phone.get("/api/v1/cart", { headers: bearer(app) })).json()).cart.version;
}

/** What the app does in the background: ask the live feed, and ask again whenever it times out. */
async function nextChange(app: AppSession, after: number): Promise<{ cart: FeedCart; at: number }> {
  for (let round = 0; round < 4; round++) {
    const body = await (await phone.get(`/api/v1/cart/changes?after=${after}`, { headers: bearer(app) })).json();
    if (body.changed) return { cart: body.cart as FeedCart, at: Date.now() };
  }
  throw new Error("The cart never changed");
}

test("adding to the cart on the website reaches the app within a second", async ({ page }) => {
  await signIn(page, "amina");
  const app = await appSignIn(phone, "amina");

  // The app is listening before anything happens on the website.
  const listening = nextChange(app, await cartVersion(app));
  await addToCart(page, "oniko-bucket-hat", 2);
  const addedAt = Date.now();

  const { cart, at } = await listening;
  expect(cart).toMatchObject({ itemCount: 2, changedVia: "web" });
  expect(cart.lines).toEqual([expect.objectContaining({ name: "Oniko bucket hat", quantity: 2 })]);
  expect(at - addedAt).toBeLessThan(1_000);

  // Changing and removing on the website reach the app the same way.
  const changing = nextChange(app, cart.version);
  await page.goto("/cart");
  await page.getByRole("button", { name: "One fewer Oniko bucket hat" }).click();
  expect((await changing).cart.lines[0]!.quantity).toBe(1);

  const version = await cartVersion(app);
  const removing = nextChange(app, version);
  await page.getByRole("button", { name: "Remove Oniko bucket hat" }).click();
  expect((await removing).cart).toMatchObject({ itemCount: 0, lines: [] });
});

test("the open website follows changes made in the app, without a reload", async ({ page }) => {
  await signIn(page, "amina", "/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
  const app = await appSignIn(phone, "amina");

  const hat = await productBySlug("oniko-bucket-hat");
  await phone.post("/api/v1/cart/items", { headers: bearer(app), data: { productId: hat.id, quantity: 1 } });
  await expect(page.getByRole("link", { name: "Oniko bucket hat" })).toBeVisible({ timeout: 2_000 });
  await expectCartCount(page, 1);

  // Checking out in the app empties the cart on the website too.
  const placed = await phone.post("/api/v1/orders", { headers: bearer(app), data: { ...LAGOS_DELIVERY, paymentMethod: "pay_on_delivery" } });
  expect(placed.status()).toBe(201);
  await expect(page.getByText("Your cart is empty.")).toBeVisible({ timeout: 2_000 });
  await expectCartCount(page, 0);
});

test("the feed waits, then says nothing changed", async () => {
  const app = await appSignIn(phone, "amina");
  const version = await cartVersion(app);
  const started = Date.now();
  const body = await (await phone.get(`/api/v1/cart/changes?after=${version}&wait=1`, { headers: bearer(app) })).json();
  expect(body).toEqual({ changed: false, version });
  expect(Date.now() - started).toBeGreaterThanOrEqual(900);
});

test("a cart someone else changes isn't announced to this account", async ({ page }) => {
  await signIn(page, "tunde");
  const amina = await appSignIn(phone, "amina");
  const version = await cartVersion(amina);
  await addToCart(page, "market-tote");
  const body = await (await phone.get(`/api/v1/cart/changes?after=${version}&wait=1`, { headers: bearer(amina) })).json();
  expect(body.changed).toBe(false);
});

test("guests' pages don't listen to the live feed", async ({ page }) => {
  const feedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/cart/changes")) feedRequests.push(request.url());
  });
  await addToCart(page, "market-tote");
  await page.goto("/cart");
  await page.waitForTimeout(500);
  expect(feedRequests).toEqual([]);
});
