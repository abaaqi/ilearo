import { expect, test, type Page } from "@playwright/test";
import { ordersFor, productBySlug, resetDatabase, setStock, sql, userByEmail } from "./support/db";
import { ACCOUNTS, chooseGoogleAccount, failNextEmails, resetMocks, sentEmails, signIn, waitForEmails } from "./support/mocks";
import { addToCart, expectCartCount, fillDelivery, placeOrderButton } from "./support/shop";

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
});

const orderUrl = /\/orders\/IA-[0-9A-Z]{6}\?placed=1$/;

async function checkoutAs(page: Page, account: keyof typeof ACCOUNTS) {
  await signIn(page, account, "/checkout");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Checkout");
}

test("checking out asks a guest to sign in with Google, then keeps their cart", async ({ page }) => {
  await addToCart(page, "ibadandun-panel-cloth", 2);
  await page.goto("/cart");
  await page.getByRole("link", { name: "Check out" }).click();

  await expect(page).toHaveURL("/signin?returnTo=%2Fcheckout");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to check out");
  await chooseGoogleAccount(page, "amina");

  await expect(page).toHaveURL("/checkout");
  await expect(page.getByText("Signed in as Amina Bello (amina.bello@example.com).")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Your order" })).toContainText("Ibadandun panel cloth");
  await expectCartCount(page, 2);

  // The guest cart now belongs to the account; the cookie-only cart is gone.
  const user = await userByEmail(ACCOUNTS.amina.email);
  expect(user?.name).toBe("Amina Bello");
  const carts = await sql<{ userId: string | null }[]>`select user_id from carts`;
  expect(carts).toEqual([{ userId: user!.id }]);
});

test("an order is placed, stock and cart updated, and a confirmation emailed", async ({ page }) => {
  await addToCart(page, "ibadandun-panel-cloth", 2);
  await addToCart(page, "oniko-bucket-hat", 1);
  await checkoutAs(page, "amina");

  // Nothing filled in yet: each problem is listed and linked to its field.
  await page.getByLabel("Full name").fill("");
  await placeOrderButton(page).click();
  const problems = page.getByRole("main").getByRole("alert");
  await expect(problems).toBeFocused();
  await expect(problems).toContainText("Some details need fixing before we can place your order.");
  await expect(problems.getByRole("link")).toHaveText([
    "Enter the name of the person receiving the order.",
    "Enter a Nigerian mobile number, like 0803 123 4567.",
    "Enter a street address, like 12 Adeola Odeku Street.",
    "Enter the town or city.",
    "Choose the state for delivery.",
  ]);
  await expect(page.getByLabel("Phone number")).toHaveAttribute("aria-invalid", "true");

  // A bad phone number keeps everything else that was typed.
  await fillDelivery(page, { phone: "0803 12", notes: "Call at the gate <b>please</b>" });
  await placeOrderButton(page).click();
  await expect(page.getByRole("main").getByRole("alert").getByRole("link")).toHaveText(["Enter a Nigerian mobile number, like 0803 123 4567."]);
  await expect(page.getByLabel("Street address")).toHaveValue("14 Adeola Odeku Street");
  await expect(page.getByLabel("State", { exact: true })).toHaveValue("Lagos");

  await page.getByLabel("Phone number").fill("0803 123 4567");
  await expect(page.getByText("Delivery to Lagos: ₦2,500, usually 1–2 working days.")).toBeVisible();
  await page.getByLabel(/Bank transfer/).check();
  await expect(placeOrderButton(page)).toHaveText("Place order for ₦76,000");
  await placeOrderButton(page).click();

  await expect(page).toHaveURL(orderUrl);
  const reference = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you, Amina");
  await expect(page.getByText(`Order ${reference} is placed.`)).toBeVisible();
  const howToPay = page.getByRole("region", { name: "How to pay" });
  await expect(howToPay).toContainText("Transfer ₦76,000 to:");
  await expect(howToPay).toContainText("0123456789");
  await expect(howToPay).toContainText(reference);
  await expect(page.getByText("Call at the gate <b>please</b>")).toBeVisible();
  await expectCartCount(page, 0);

  // Database: totals worked out from catalogue prices, stock reduced, cart emptied.
  const [order] = await ordersFor(ACCOUNTS.amina.email);
  expect(order).toMatchObject({
    reference,
    status: "placed",
    paymentMethod: "bank_transfer",
    paymentStatus: "unpaid",
    subtotalKobo: 2 * 3_200_000 + 950_000,
    deliveryKobo: 250_000,
    totalKobo: 7_600_000,
    phone: "+2348031234567",
    state: "Lagos",
  });
  const items = await sql<{ productName: string; quantity: number; lineTotalKobo: number }[]>`
    select product_name, quantity, line_total_kobo from order_items where order_id = ${order!.id} order by product_name`;
  expect(items).toEqual([
    { productName: "Ibadandun panel cloth", quantity: 2, lineTotalKobo: 6_400_000 },
    { productName: "Oniko bucket hat", quantity: 1, lineTotalKobo: 950_000 },
  ]);
  expect((await productBySlug("ibadandun-panel-cloth")).stock).toBe(6);
  expect((await productBySlug("oniko-bucket-hat")).stock).toBe(2);
  expect(await sql`select 1 from cart_items`).toHaveLength(0);

  // Email: one message through Mailgun, to the Google address, with escaped notes.
  const [email] = await waitForEmails(1);
  expect(email).toMatchObject({
    to: ACCOUNTS.amina.email,
    from: "Ile Aro <orders@mg.ilearo.test>",
    subject: `Your Ile Aro order ${reference}`,
    replyTo: "hello@ilearo.test",
    tags: ["order-confirmation"],
    variables: { order_reference: reference },
  });
  expect(email!.text).toContain("Transfer ₦76,000 to:");
  expect(email!.text).toContain("Victoria Island, Lagos");
  expect(email!.html).toContain(`http://localhost:3100/orders/${reference}`);
  expect(email!.html).toContain("&lt;b&gt;please&lt;/b&gt;");
  expect(email!.html).not.toContain("<b>please</b>");

  await expect
    .poll(async () => (await sql`select status, provider_message_id from email_log`).map((r) => r.status))
    .toEqual(["sent"]);
  const [log] = await sql<{ providerMessageId: string; toEmail: string }[]>`select provider_message_id, to_email from email_log`;
  expect(log).toEqual({ providerMessageId: email!.id, toEmail: ACCOUNTS.amina.email });
  expect((await ordersFor(ACCOUNTS.amina.email))[0]!.confirmationEmailSentAt).not.toBeNull();

  // The order shows up in the account, and checkout remembers the address next time.
  await page.getByRole("link", { name: "All your orders" }).click();
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
  await addToCart(page, "market-tote");
  await page.goto("/checkout");
  await expect(page.getByLabel("Street address")).toHaveValue("14 Adeola Odeku Street");
  await expect(page.getByLabel("Phone number")).toHaveValue("0803 123 4567");
});

test("orders of ₦100,000 or more ship free, and pay on delivery is the default", async ({ page }) => {
  await addToCart(page, "stitched-kaftan", 2);
  await addToCart(page, "oniko-bucket-hat", 1);
  await checkoutAs(page, "tunde");
  await fillDelivery(page, { fullName: "Tunde Adeyemi", city: "Kano", state: "Kano", address2: "" });
  await expect(page.getByText("Free delivery to Kano, usually 3–6 working days.")).toBeVisible();
  await expect(page.getByLabel(/Pay on delivery/)).toBeChecked();
  await placeOrderButton(page).click();

  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByText("Pay ₦105,500 when your order arrives")).toBeVisible();
  const [order] = await ordersFor(ACCOUNTS.tunde.email);
  expect(order).toMatchObject({ subtotalKobo: 10_550_000, deliveryKobo: 0, totalKobo: 10_550_000, paymentMethod: "pay_on_delivery" });
  const [email] = await waitForEmails(1);
  expect(email!.text).toContain("Pay ₦105,500 when your order arrives");
  expect(email!.text).toContain("Delivery   Free");
});

test("stock is checked again at the moment the order is placed", async ({ page }) => {
  await addToCart(page, "oniko-bucket-hat", 2);
  await checkoutAs(page, "amina");
  await fillDelivery(page);

  // Someone else buys hats while Amina is filling in the form.
  await setStock("oniko-bucket-hat", 1);
  await placeOrderButton(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Oniko bucket hat: only 1 left, and your cart has 2. Update your cart, then come back to check out.",
  );
  await expect(page.getByRole("main").getByRole("alert").getByRole("link", { name: "Go to your cart" })).toBeVisible();
  expect(await ordersFor(ACCOUNTS.amina.email)).toHaveLength(0);
  expect((await productBySlug("oniko-bucket-hat")).stock).toBe(1);
  expect(await sentEmails()).toHaveLength(0);
});

test("two shoppers racing for the last piece can't both buy it", async ({ browser }) => {
  await setStock("oniko-bucket-hat", 1);
  const shoppers = await Promise.all(
    (["amina", "tunde"] as const).map(async (account) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await addToCart(page, "oniko-bucket-hat", 1);
      await checkoutAs(page, account);
      await fillDelivery(page, { fullName: ACCOUNTS[account].name });
      return { account, context, page };
    }),
  );

  await Promise.all(shoppers.map(({ page }) => placeOrderButton(page).click()));
  const outcomes = await Promise.all(
    shoppers.map(({ page }) =>
      Promise.race([
        page.waitForURL(orderUrl).then(() => "ordered"),
        page
          .getByRole("alert")
          .filter({ hasText: "has sold out" })
          .waitFor()
          .then(() => "refused"),
      ]),
    ),
  );

  expect(outcomes.sort()).toEqual(["ordered", "refused"]);
  expect((await productBySlug("oniko-bucket-hat")).stock).toBe(0);
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from orders`;
  expect(count).toBe(1);
  await Promise.all(shoppers.map(({ context }) => context.close()));
});

test("clicking Place order twice still makes one order", async ({ page }) => {
  await addToCart(page, "market-tote", 1);
  await checkoutAs(page, "amina");
  await fillDelivery(page);
  // Submit twice without waiting, as a double-click on a slow connection would.
  await page.locator("form", { has: placeOrderButton(page) }).evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page).toHaveURL(orderUrl);
  expect(await ordersFor(ACCOUNTS.amina.email)).toHaveLength(1);
  expect((await productBySlug("market-tote")).stock).toBe(24);
  await waitForEmails(1);
});

test("if Mailgun is down the order still goes through and the failure is logged", async ({ page }) => {
  await failNextEmails(1);
  await addToCart(page, "market-tote", 1);
  await checkoutAs(page, "amina");
  await fillDelivery(page);
  await placeOrderButton(page).click();

  await expect(page).toHaveURL(orderUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you, Amina");
  await expect
    .poll(async () => (await sql<{ status: string }[]>`select status from email_log`).map((r) => r.status))
    .toEqual(["failed"]);
  const [log] = await sql<{ error: string }[]>`select error from email_log`;
  expect(log!.error).toContain("Mailgun answered 500");
  expect((await ordersFor(ACCOUNTS.amina.email))[0]!.confirmationEmailSentAt).toBeNull();
  expect(await sentEmails()).toHaveLength(0);
});

test("checkout with an empty cart points back to the shop", async ({ page }) => {
  await checkoutAs(page, "amina");
  await expect(page.getByText("Your cart is empty, so there's nothing to check out yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse the shop" })).toBeVisible();
});
