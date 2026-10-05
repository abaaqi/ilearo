import { expect, test, type APIRequestContext } from "@playwright/test";
import { ordersFor, productBySlug, resetDatabase, sql, userByEmail } from "./support/db";
import { ACCOUNTS, resetMocks, signIn, waitForEmails } from "./support/mocks";
import { LAGOS_DELIVERY } from "./support/shop";
import { APP_REDIRECT, appSignIn, bearer, browserSignIn, newPhone, pkcePair, signInUrl } from "./support/app";

let phone: APIRequestContext;

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
  phone = await newPhone();
});

test.afterEach(async () => {
  await phone.dispose();
});

test.describe("one account on the website and the app", () => {
  test("the app signs in with the same Google account and gets the same account", async ({ page }) => {
    await signIn(page, "amina");
    const website = await userByEmail(ACCOUNTS.amina.email);

    const app = await appSignIn(phone, "amina");
    expect(app.user).toMatchObject({ id: website!.id, email: ACCOUNTS.amina.email, name: ACCOUNTS.amina.name });

    const me = await phone.get("/api/v1/me", { headers: bearer(app) });
    expect((await me.json()).user.id).toBe(website!.id);

    // One user, two kinds of session, both hashed.
    expect(await sql`select 1 from users`).toHaveLength(1);
    const sessions = await sql<{ client: string; userId: string; id: string; userAgent: string }[]>`
      select client, user_id, id, user_agent from sessions order by client`;
    expect(sessions.map((s) => [s.client, s.userId])).toEqual([
      ["app", website!.id],
      ["web", website!.id],
    ]);
    expect(sessions[0]!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(sessions[0]!.id).not.toBe(app.token);
    expect(sessions[0]!.userAgent).toBe("Ile Aro app: Test phone");

    await page.goto("/account");
    await expect(page.getByText("Also signed in on the Ile Aro app on 1 phone, sharing this cart.")).toBeVisible();
  });

  test("signing in on the app first creates the account the website then uses", async ({ page }) => {
    const app = await appSignIn(phone, "tunde");
    await signIn(page, "tunde");
    expect((await userByEmail(ACCOUNTS.tunde.email))!.id).toBe(app.user.id);
  });

  test("a sign-in code works once, only with the app's own verifier, and not for long", async () => {
    const first = pkcePair();
    const landed = await browserSignIn(phone, "amina", { challenge: first.challenge });
    const code = landed.searchParams.get("code");

    const wrong = await phone.post("/api/v1/auth/token", { data: { code, codeVerifier: pkcePair().verifier } });
    expect(wrong.status()).toBe(400);
    // The failed attempt used the code up, so the right verifier is now too late as well.
    const late = await phone.post("/api/v1/auth/token", { data: { code, codeVerifier: first.verifier } });
    expect(late.status()).toBe(400);

    const second = pkcePair();
    const again = await browserSignIn(phone, "amina", { challenge: second.challenge });
    await sql`update app_sign_in_codes set expires_at = now() - interval '1 second' where used_at is null`;
    const expired = await phone.post("/api/v1/auth/token", {
      data: { code: again.searchParams.get("code"), codeVerifier: second.verifier },
    });
    expect(expired.status()).toBe(400);
    expect((await expired.json()).error).toBe("That sign-in has expired or was already used. Try signing in again.");
    expect(await sql`select 1 from sessions`).toHaveLength(0);
  });

  test("a sign-in for Expo Go goes back to Expo Go", async () => {
    const { challenge } = pkcePair();
    const landed = await browserSignIn(phone, "amina", { challenge, redirectUri: "exp://192.168.1.20:8081/--/auth" });
    expect(landed.toString()).toMatch(/^exp:\/\/192\.168\.1\.20:8081\/--\/auth\?code=[A-Za-z0-9_-]{43}$/);
  });

  test("cancelling at Google tells the app", async () => {
    const landed = await browserSignIn(phone, "cancel", { challenge: pkcePair().challenge });
    expect(landed.toString()).toBe(`${APP_REDIRECT}?error=cancelled`);
  });

  for (const [label, redirectUri] of [
    ["a website", "https://evil.example/collect"],
    ["Expo Go on a public address", "exp://203.0.113.9:8081/--/auth"],
  ] as const) {
    test(`sign-in won't send a code to ${label}`, async () => {
      const response = await phone.get(signInUrl(redirectUri, pkcePair().challenge), { maxRedirects: 0 });
      expect(response.status()).toBe(400);
      expect(await response.text()).toContain("This sign-in link isn't one we recognise");
    });
  }

  test("app tokens and website cookies only work where they were issued", async ({ page, context }) => {
    const app = await appSignIn(phone, "amina");
    await context.addCookies([{ name: "ia_session", value: app.token, url: "http://localhost:3100" }]);
    await page.goto("/account");
    await expect(page).toHaveURL("/signin?returnTo=%2Faccount");

    await signIn(page, "amina");
    const webToken = (await context.cookies()).find((c) => c.name === "ia_session")!.value;
    const response = await phone.get("/api/v1/me", { headers: { Authorization: `Bearer ${webToken}` } });
    expect(response.status()).toBe(401);
  });

  test("signing out of the app ends only the app's session", async ({ page }) => {
    await signIn(page, "amina");
    const app = await appSignIn(phone, "amina");
    expect((await phone.post("/api/v1/auth/sign-out", { headers: bearer(app) })).status()).toBe(200);

    const me = await phone.get("/api/v1/me", { headers: bearer(app) });
    expect(me.status()).toBe(401);
    expect(await me.json()).toEqual({ error: "You've been signed out. Sign in again to carry on.", signedOut: true });
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your account");
  });
});

test.describe("the catalogue", () => {
  test("lists and filters products like the shop page", async () => {
    const all = (await (await phone.get("/api/v1/products")).json()).products;
    expect(all).toHaveLength(14);
    expect(all[0]).toMatchObject({
      slug: "olosupa-moon-cloth",
      name: "Olosupa moon cloth",
      priceKobo: 2_400_000,
      categoryLabel: "Cloth",
      techniqueLabel: "Oniko",
      image: { kind: "art", url: expect.stringMatching(/^\/api\/v1\/art\/v1\/[a-z]+-[a-z]+-\d+\.svg$/) },
    });
    const filtered = (await (await phone.get("/api/v1/products?category=cloth&technique=oniko")).json()).products;
    expect(filtered).toHaveLength(2);
  });

  test("shows one product with its details and related pieces", async () => {
    const { product } = await (await phone.get("/api/v1/products/oniko-bucket-hat")).json();
    expect(product).toMatchObject({ name: "Oniko bucket hat", stock: 3, maxQuantity: 3, techniqueShort: "Tied" });
    expect(product.details.length).toBeGreaterThan(0);
    expect(product.related).toHaveLength(4);
    expect((await phone.get("/api/v1/products/not-a-product")).status()).toBe(404);
  });

  test("serves the swatches as cacheable SVG files", async () => {
    const { products } = await (await phone.get("/api/v1/products")).json();
    const art = await phone.get(products[0].image.url);
    expect(art.status()).toBe(200);
    expect(art.headers()["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(art.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(await art.text()).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect((await phone.get("/api/v1/art/v1/plaid-deep-1.svg")).status()).toBe(404);
    expect((await phone.get("/api/v1/art/v0/moons-deep-1.svg")).status()).toBe(404);
  });

  test("describes the shop for the app's screens", async () => {
    const { shop } = await (await phone.get("/api/v1/shop")).json();
    expect(shop.categories.map((c: { label: string }) => c.label)).toEqual(["Cloth", "Scarves", "Bags", "Homeware", "Wear"]);
    expect(shop.states).toHaveLength(37);
    expect(shop.states.find((s: { name: string }) => s.name === "Oyo").zone).toBe("south-west");
    expect(shop).toMatchObject({ freeDeliveryFromKobo: 10_000_000, maxPerItem: 10, bankTransfer: true });
  });
});

test.describe("the cart", () => {
  test("follows the website's rules and wording", async () => {
    const app = await appSignIn(phone, "amina");
    const hat = await productBySlug("oniko-bucket-hat");
    const add = (quantity: number) => phone.post("/api/v1/cart/items", { headers: bearer(app), data: { productId: hat.id, quantity } });

    let body = await (await add(2)).json();
    expect(body).toMatchObject({ ok: true, message: "Added to your cart. You have 2." });
    expect(body.cart).toMatchObject({ itemCount: 2, subtotalKobo: 1_900_000, changedVia: "app" });
    expect(body.guestCartId).toBeUndefined();

    body = await (await add(5)).json();
    expect(body.message).toBe("Added 1, which is all we have. You have 3 in your cart.");
    body = await (await add(1)).json();
    expect(body).toMatchObject({ ok: false, message: "You already have all 3 we have in your cart." });
    expect(body.cart.lines[0]).toMatchObject({ quantity: 3, canAddOne: false });

    const update = (quantity: number) =>
      phone.put(`/api/v1/cart/items/${hat.id}`, { headers: bearer(app), data: { quantity } });
    await sql`update products set stock = 2 where id = ${hat.id}`;
    body = await (await phone.get("/api/v1/cart", { headers: bearer(app) })).json();
    expect(body.cart).toMatchObject({ hasProblems: true });
    expect(body.cart.lines[0]).toMatchObject({ problem: "short", problemText: "Only 2 left. Lower the quantity to check out." });

    expect((await (await update(3)).json()).ok).toBe(true); // going down (or staying put) is always allowed
    body = await (await update(2)).json();
    expect(body).toMatchObject({ ok: true, cart: { hasProblems: false } });

    body = await (await phone.delete(`/api/v1/cart/items/${hat.id}`, { headers: bearer(app) })).json();
    expect(body).toMatchObject({ ok: true, cart: { itemCount: 0, lines: [] } });
  });

  test("works signed out, and the guest cart joins the account on sign-in", async () => {
    const cloth = await productBySlug("ibadandun-panel-cloth");
    const tote = await productBySlug("market-tote");
    const first = await (await phone.post("/api/v1/cart/items", { data: { productId: cloth.id, quantity: 1 } })).json();
    expect(first.ok).toBe(true);
    const guestCartId: string = first.guestCartId;
    expect(guestCartId).toMatch(/^[0-9a-f-]{36}$/);

    const second = await (
      await phone.post("/api/v1/cart/items", { headers: { "X-Guest-Cart": guestCartId }, data: { productId: tote.id } })
    ).json();
    expect(second).toMatchObject({ guestCartId, cart: { itemCount: 2 } });

    const app = await appSignIn(phone, "amina", { guestCartId });
    const { cart } = await (await phone.get("/api/v1/cart", { headers: bearer(app) })).json();
    expect(cart.lines.map((l: { slug: string }) => l.slug)).toEqual(["ibadandun-panel-cloth", "market-tote"]);
    expect(await sql`select 1 from carts where id = ${guestCartId}`).toHaveLength(0);
  });

  test("website cookies can't change a cart through the API", async ({ page }) => {
    await signIn(page, "amina");
    const tote = await productBySlug("market-tote");
    // The browser sends Amina's session cookie, but changes need the app's token.
    const response = await page.request.post("/api/v1/cart/items", { data: { productId: tote.id } });
    expect((await response.json()).guestCartId).toBeTruthy();
    const amina = await userByEmail(ACCOUNTS.amina.email);
    expect(await sql`select 1 from carts c join cart_items ci on ci.cart_id = c.id where c.user_id = ${amina!.id}`).toHaveLength(0);

    // Reading with cookies is fine: that's how the website follows the live cart.
    expect((await (await page.request.get("/api/v1/me")).json()).user.email).toBe(ACCOUNTS.amina.email);
  });

  test("refuses bodies that aren't JSON", async () => {
    const response = await phone.post("/api/v1/cart/items", { form: { productId: "x" } });
    expect(response.status()).toBe(415);
  });
});

test.describe("checking out in the app", () => {
  test("places the order the same way the website does", async ({ page }) => {
    const app = await appSignIn(phone, "amina");
    const tote = await productBySlug("market-tote");
    await phone.post("/api/v1/cart/items", { headers: bearer(app), data: { productId: tote.id, quantity: 2 } });

    const info = await (await phone.get("/api/v1/checkout", { headers: bearer(app) })).json();
    expect(info.contact.email).toBe(ACCOUNTS.amina.email);
    expect(info.defaults).toEqual({ fullName: ACCOUNTS.amina.name });
    expect(info.paymentMethods.map((m: { value: string }) => m.value)).toEqual(["pay_on_delivery", "bank_transfer"]);

    const invalid = await phone.post("/api/v1/orders", {
      headers: bearer(app),
      data: { ...LAGOS_DELIVERY, phone: "12345", paymentMethod: "bank_transfer" },
    });
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).fieldErrors).toEqual({ phone: "Enter a Nigerian mobile number, like 0803 123 4567." });

    const placed = await phone.post("/api/v1/orders", {
      headers: bearer(app),
      data: { ...LAGOS_DELIVERY, paymentMethod: "bank_transfer" },
    });
    expect(placed.status()).toBe(201);
    const { reference, cart: emptied } = await placed.json();
    expect(emptied).toMatchObject({ itemCount: 0, changedVia: "app" });

    const [order] = await ordersFor(ACCOUNTS.amina.email);
    expect(order).toMatchObject({ reference, subtotalKobo: 2 * tote.priceKobo, deliveryKobo: 250_000, phone: "+2348031234567" });
    const [email] = await waitForEmails(1);
    expect(email!.subject).toBe(`Your Ile Aro order ${reference}`);

    const detail = (await (await phone.get(`/api/v1/orders/${reference}`, { headers: bearer(app) })).json()).order;
    expect(detail).toMatchObject({
      paymentLabel: "Waiting for your transfer",
      bankTransfer: { accountNumber: "0123456789", narration: reference },
      deliveryDays: "1–2 working days",
    });
    const cart = (await (await phone.get("/api/v1/cart", { headers: bearer(app) })).json()).cart;
    expect(cart.itemCount).toBe(0);

    // A second tap finds the order the first one placed.
    const again = await phone.post("/api/v1/orders", { headers: bearer(app), data: { ...LAGOS_DELIVERY, paymentMethod: "bank_transfer" } });
    expect(await again.json()).toMatchObject({ reference, alreadyPlaced: true });

    // The order is on the same account on the website.
    await signIn(page, "amina");
    await expect(page.getByRole("link", { name: reference })).toBeVisible();
    const orders = (await (await phone.get("/api/v1/orders", { headers: bearer(app) })).json()).orders;
    expect(orders).toHaveLength(1);
  });

  test("needs a signed-in app", async () => {
    expect((await phone.get("/api/v1/checkout")).status()).toBe(401);
    expect((await phone.post("/api/v1/orders", { data: LAGOS_DELIVERY })).status()).toBe(401);
    expect((await phone.get("/api/v1/orders", { headers: { Authorization: "Bearer nonsense-token-value" } })).status()).toBe(401);
  });
});
