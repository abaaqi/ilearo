import { expect, test } from "@playwright/test";
import { ordersFor, resetDatabase, sql } from "./support/db";
import { ACCOUNTS, MOCK_URL, breakNextIdToken, chooseGoogleAccount, resetMocks, signIn } from "./support/mocks";
import { addToCart, fillDelivery, placeOrderButton } from "./support/shop";

test.beforeEach(async () => {
  await resetDatabase();
  await resetMocks();
});

const sessionCount = async () => (await sql<{ n: number }[]>`select count(*)::int as n from sessions`)[0]!.n;

test("signing in creates the user and a hashed session; signing out ends it", async ({ page, context }) => {
  await signIn(page, "amina");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your account");
  await expect(page.getByText(ACCOUNTS.amina.email)).toBeVisible();

  const [session] = await sql<{ id: string }[]>`select id from sessions`;
  const cookie = (await context.cookies()).find((c) => c.name === "ia_session");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  // Only a SHA-256 hash of the cookie is stored.
  expect(session!.id).toMatch(/^[0-9a-f]{64}$/);
  expect(session!.id).not.toBe(cookie!.value);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(await sessionCount()).toBe(0);
  await page.goto("/account");
  await expect(page).toHaveURL("/signin?returnTo=%2Faccount");
});

test("orders are private to the account that placed them", async ({ page, browser }) => {
  await addToCart(page, "market-tote");
  await signIn(page, "amina", "/checkout");
  await fillDelivery(page);
  await placeOrderButton(page).click();
  await page.waitForURL(/\/orders\//);
  const path = new URL(page.url()).pathname;

  const other = await browser.newContext();
  const tunde = await other.newPage();
  const signedOut = await tunde.goto(path);
  expect(signedOut?.url()).toContain(`/signin?returnTo=${encodeURIComponent(path)}`);

  await chooseGoogleAccount(tunde, "tunde");
  await expect(tunde.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(tunde.getByText("Amina")).toHaveCount(0);
  expect(await ordersFor(ACCOUNTS.tunde.email)).toHaveLength(0);
  await other.close();
});

test("cancelling at Google comes back with a clear message", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL("/signin?error=cancelled");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sign-in was cancelled. You can try again whenever you're ready.");
  expect(await sessionCount()).toBe(0);
});

test("a callback that didn't start in this browser is refused", async ({ page }) => {
  await page.goto("/api/auth/google/callback?code=stolen&state=whatever");
  await expect(page).toHaveURL("/signin?error=expired");
  expect(await sessionCount()).toBe(0);
});

test("a callback with the wrong state is refused (login CSRF)", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.waitForURL(`${MOCK_URL}/authorize**`);
  // Tamper with the state Google would hand back.
  const approve = new URL(await page.getByRole("link", { name: "Amina Bello" }).getAttribute("href") ?? "", MOCK_URL);
  approve.searchParams.set("state", "attacker-state");
  await page.goto(approve.toString());
  await expect(page).toHaveURL("/signin?error=state");
  expect(await sessionCount()).toBe(0);
});

for (const fault of ["wrong-audience", "wrong-issuer", "wrong-nonce", "expired"] as const) {
  test(`an ID token with ${fault.replace("-", " ")} is rejected`, async ({ page }) => {
    await breakNextIdToken(fault);
    await page.goto("/signin");
    await chooseGoogleAccount(page, "amina");
    await expect(page).toHaveURL("/signin?error=google");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Google didn't finish signing you in. Try again in a moment.");
    expect(await sessionCount()).toBe(0);
    expect(await sql`select 1 from users`).toHaveLength(0);
  });
}

test("Google accounts without a verified email can't sign in", async ({ page }) => {
  await page.goto("/signin");
  await chooseGoogleAccount(page, "unverified");
  await expect(page).toHaveURL("/signin?error=unverified");
  expect(await sessionCount()).toBe(0);
});

test("the post-sign-in redirect stays on this site", async ({ page }) => {
  await page.goto("/signin?returnTo=//evil.example/steal");
  await chooseGoogleAccount(page, "amina");
  await expect(page).toHaveURL("/");
});

test("an expired session counts as signed out", async ({ page }) => {
  await signIn(page, "amina");
  await sql`update sessions set expires_at = now() - interval '1 minute'`;
  await page.goto("/account");
  await expect(page).toHaveURL("/signin?returnTo=%2Faccount");
});
