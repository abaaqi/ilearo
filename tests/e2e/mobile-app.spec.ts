import { existsSync } from "node:fs";
import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { resetDatabase, sql, userByEmail } from "./support/db";
import { ACCOUNTS, resetMocks, signIn } from "./support/mocks";
import { addToCart } from "./support/shop";

/**
 * The mobile app itself (mobile/), built for the browser and run at phone
 * size, against the real website and API. It's the same code that runs on a
 * phone; only the sign-in window differs (a pop-up here, the phone's browser
 * sheet there). Build it first: npm run build:app-web (npm run test:app does).
 */

const APP = "http://localhost:3200";
const SCREENS = "test-results/app-screens";

test.skip(!existsSync("mobile/dist-web/index.html"), "Build the app for the browser first: npm run build:app-web");

const laptops: BrowserContext[] = [];

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
});

test.afterEach(async () => {
  // Closing the laptop's browser also stops its website listening to the live cart.
  await Promise.all(laptops.splice(0).map((context) => context.close()));
});

/** The website on a laptop, beside the phone. */
async function laptop(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices["Desktop Chrome"], baseURL: "http://localhost:3100" });
  laptops.push(context);
  return context.newPage();
}

const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name });

async function signInOnApp(page: Page, account: keyof typeof ACCOUNTS) {
  await page.goto(`${APP}/account`);
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const google = await popup;
  await google.getByRole("link", { name: ACCOUNTS[account].name }).click();
  await expect(page.getByTestId("account-email")).toHaveText(ACCOUNTS[account].email);
}

test("a shopper browses and fills a cart without signing in", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByRole("heading", { name: "Adire, dyed by hand in Abeokuta" })).toBeVisible();
  await expect(page.getByText("14 pieces")).toBeVisible();
  await expect(page.getByTestId("product-olosupa-moon-cloth")).toContainText("₦24,000");
  await page.screenshot({ path: `${SCREENS}/1-shop.png` });

  await page.getByRole("button", { name: "Cloth", exact: true }).click();
  await expect(page.getByText("6 pieces")).toBeVisible();
  await page.getByTestId("product-ibadandun-panel-cloth").click();
  await expect(page.getByRole("heading", { name: "Ibadandun panel cloth" })).toBeVisible();
  await page.getByRole("button", { name: "One more Ibadandun panel cloth" }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to your cart. You have 2.")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/2-product.png` });

  // The guest cart lives on the server, under an id the app keeps.
  const [guest] = await sql<{ userId: string | null; items: number }[]>`
    select c.user_id, sum(ci.quantity)::int as items from carts c join cart_items ci on ci.cart_id = c.id group by c.id`;
  expect(guest).toEqual({ userId: null, items: 2 });

  await page.goto(`${APP}/cart`);
  await expect(page.getByTestId("cart-line-ibadandun-panel-cloth")).toContainText("₦64,000");
  await expect(page.getByText("Sign in to share this cart with the website, on any device.")).toBeVisible();
  await expect(tab(page, /^Cart, 2 items/)).toBeVisible();
});

test("one account and one live cart across the website and the app", async ({ page, browser }) => {
  // On the laptop, Amina is signed in to the website with Google.
  const site = await laptop(browser);
  await signIn(site, "amina", "/cart");
  await expect(site.getByText("Your cart is empty.")).toBeVisible();

  // On the phone, she signs in to the app with the same Google account.
  await signInOnApp(page, "amina");
  await expect(page.getByText(/This is the same account as on localhost:3200/)).toBeVisible();
  const amina = await userByEmail(ACCOUNTS.amina.email);
  const sessions = await sql<{ client: string; userId: string }[]>`select client, user_id from sessions order by client`;
  expect(sessions).toEqual([
    { client: "app", userId: amina!.id },
    { client: "web", userId: amina!.id },
  ]);
  await page.screenshot({ path: `${SCREENS}/3-account.png` });

  // The phone sits on its cart, listening.
  await tab(page, /^Cart/).click();
  await expect(page.getByTestId("live-status")).toContainText("Live with localhost:3200");

  // She adds a hat on the website. The phone shows it straight away, without a refresh.
  await addToCart(site, "oniko-bucket-hat", 2);
  const added = Date.now();
  await expect(page.getByTestId("cart-line-oniko-bucket-hat")).toBeVisible({ timeout: 2_000 });
  const arrivedAfter = Date.now() - added;
  await expect(page.getByTestId("cart-notice")).toContainText("On the website");
  await expect(page.getByTestId("cart-notice")).toContainText("Oniko bucket hat added");
  await expect(tab(page, /^Cart, 2 items/)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/4-cart-live.png` });
  await site.screenshot({ path: `${SCREENS}/4-website.png` });
  console.log(`Website → app: the hat appeared on the phone ${arrivedAfter} ms after the website confirmed it.`);
  expect(arrivedAfter).toBeLessThan(2_000);

  // A change in the app reaches the open website the same way.
  await site.goto("/cart");
  await expect(site.getByLabel("Quantity of Oniko bucket hat")).toHaveText("2");
  await page.getByRole("button", { name: "One fewer Oniko bucket hat" }).click();
  await expect(site.getByLabel("Quantity of Oniko bucket hat")).toHaveText("1", { timeout: 2_000 });

  // She checks out on the phone.
  await page.getByTestId("check-out").click();
  await expect(page.getByText(`Signed in as ${ACCOUNTS.amina.name}`)).toBeVisible();
  await page.getByLabel("Full name").fill("Amina Bello");
  await page.getByLabel("Phone number").fill("0803 123 4567");
  await page.getByLabel("Street address").fill("14 Adeola Odeku Street");
  await page.getByLabel("Town or city").fill("Victoria Island");
  await page.getByRole("button", { name: /^State: / }).click();
  await page.getByRole("radio", { name: "Lagos" }).click();
  await expect(page.getByRole("radio", { name: "Kogi" })).toBeHidden();
  await expect(page.getByText("Delivery to Lagos: ₦2,500, usually 1–2 working days.")).toBeVisible();
  await page.getByRole("radio", { name: /^Bank transfer/ }).click();
  // The banner about the website's change has gone by itself by now.
  await expect(page.getByTestId("cart-notice")).toBeHidden({ timeout: 7_000 });
  await page.screenshot({ path: `${SCREENS}/5-checkout.png` });
  await page.getByRole("button", { name: "Place order for ₦12,000" }).click();

  await expect(page.getByRole("heading", { name: "Thank you, Amina" })).toBeVisible();
  await expect(page.getByText("0123456789")).toBeVisible();
  // Emptying the cart was this phone's own doing, so it isn't announced as news.
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId("cart-notice")).toBeHidden();
  await page.screenshot({ path: `${SCREENS}/6-order.png` });
  const [order] = await sql<{ reference: string; totalKobo: number }[]>`select reference, total_kobo from orders`;
  expect(order!.totalKobo).toBe(1_200_000);

  // The website empties its cart by itself, and the order is on her account there.
  await expect(site.getByText("Your cart is empty.")).toBeVisible({ timeout: 2_000 });
  await site.goto("/account");
  await expect(site.getByRole("link", { name: order!.reference })).toBeVisible();
  await expect(site.getByText("Also signed in on the Ile Aro app on 1 phone, sharing this cart.")).toBeVisible();
});

test("checkout in the app follows a change made on the website", async ({ page, browser }) => {
  const site = await laptop(browser);
  await signIn(site, "amina");
  await signInOnApp(page, "amina");
  await page.goto(`${APP}/products/market-tote`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to your cart. You have 1.")).toBeVisible();

  await page.goto(`${APP}/checkout`);
  await expect(page.getByRole("button", { name: "Place order for ₦13,000" })).toBeVisible();
  await addToCart(site, "oniko-bucket-hat");
  await expect(page.getByRole("button", { name: "Place order for ₦22,500" })).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText("Oniko bucket hat", { exact: true })).toBeVisible();
});

test("a guest cart from the app joins the account when the shopper signs in", async ({ page }) => {
  await page.goto(`${APP}/products/market-tote`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to your cart. You have 1.")).toBeVisible();

  await signInOnApp(page, "tunde");
  await tab(page, /^Cart/).click();
  await expect(page.getByTestId("cart-line-market-tote")).toBeVisible();
  const tunde = await userByEmail(ACCOUNTS.tunde.email);
  expect(await sql`select 1 from carts where user_id = ${tunde!.id}`).toHaveLength(1);
  expect(await sql`select 1 from carts where user_id is null`).toHaveLength(0);
});

test("signing out of the app ends its session and keeps the website's", async ({ page, browser }) => {
  const site = await laptop(browser);
  await signIn(site, "amina");
  await signInOnApp(page, "amina");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  expect(await sql<{ client: string }[]>`select client from sessions`).toEqual([{ client: "web" }]);
});
