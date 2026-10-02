# Ile Aro: an online shop for hand-dyed adire

A complete small shop: a catalogue, a cart, a checkout page, order history, Google
sign-in, order confirmation emails through Mailgun, and a Postgres database that can be
hosted on either **Supabase** or **Neon**.

The brand ("Ile Aro") and the 14 products are sample content. Swapping in your own
catalogue doesn't need code changes; see [Changing the shop](#changing-the-shop).

![Home page](docs/home.jpg)

| Checkout | Order placed | Confirmation email |
| --- | --- | --- |
| ![Checkout](docs/checkout.jpg) | ![Order confirmation](docs/order.jpg) | ![Email](docs/email.jpg) |

## What it does

- **Storefront.** Home page, a shop page filtered by type and dyeing technique, and a page
  for each product with stock levels ("Only 3 left", "Sold out"). Products without a photo
  get a generated adire pattern, so the sample shop looks finished before you add photos.
- **Cart.** Saved in the database, not the browser. Guests get a cart linked to a
  cookie. When they sign in, it's merged into their account's cart.
- **Checkout.** Signing in with Google is required. The checkout asks for delivery details
  (with all 36 states and the FCT) and works out the delivery fee from the state: ₦2,500
  for Lagos, ₦3,500 for the rest of the South-West, ₦5,000 for anywhere else, and free from
  ₦100,000. Customers pay on delivery, or by bank transfer if you fill in your bank details.
- **Orders.** Placed in a single database transaction. Prices come from the database,
  never from the form. Stock is locked while it's checked, so two people can't buy the last
  piece. Clicking "Place order" twice still creates only one order.
- **Emails.** An HTML and plain-text confirmation is sent through Mailgun's API after the
  order is saved. Every attempt is recorded in an `email_log` table, and a Mailgun outage
  can't stop an order going through.
- **Account.** Each customer has an order history and an order page with payment
  instructions. Customers can only see their own orders.

**Tech stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript (strict),
Tailwind CSS 4, [postgres.js](https://github.com/porsager/postgres), [jose](https://github.com/panva/jose)
for verifying Google's ID tokens, and zod. Tests use Vitest and Playwright.

## Run it on your computer

You need Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local      # then open .env.local and fill in DATABASE_URL
npm run db:setup                # creates the tables and loads the sample products
npm run dev                     # http://localhost:3000
```

With only `DATABASE_URL` filled in, browsing and the cart work. The sign-in page explains
that Google isn't set up yet, and emails are printed in the terminal instead of being sent.
To get the whole flow working, follow the three setup sections below.

## 1. Database: Supabase or Neon

The app connects to Postgres directly, so either provider works and you can switch later
by changing one variable.

**Supabase**

1. Create a project and note the database password.
2. Click **Connect** in the project dashboard and copy the **Transaction pooler** string
   (port **6543**). It works from serverless hosts like Vercel, which can't use Supabase's
   IPv6-only direct connection.
3. Replace `[YOUR-PASSWORD]` and put the result in `DATABASE_URL`. If the password contains
   characters such as `@` or `#`, URL-encode them (`@` becomes `%40`).

**Neon**

1. Create a project.
2. Click **Connect**, turn on **Connection pooling**, and copy the string. Its host contains
   `-pooler`.
3. Put it in `DATABASE_URL`.

Then run `npm run db:setup`. If you'd rather not run it from your computer, paste
[`db/schema.sql`](db/schema.sql) and then [`db/seed.sql`](db/seed.sql) into the provider's
SQL editor. Both files can be run again safely. Running the seed again updates names and
prices but leaves stock levels alone.

Notes:

- Prepared statements are turned off, which transaction poolers require. Options that some
  providers add to the URL but Postgres would reject (`channel_binding`, `pgbouncer=true`
  and similar) are removed automatically.
- On Supabase, the schema turns on row level security with no policies. That keeps these
  tables out of Supabase's public REST API, which this app doesn't use. The app's own
  connection owns the tables, so it isn't affected.
- `GET /api/health` returns `{"ok":true,...}` when the app can reach the database. It's a
  quick check after deploying.

## 2. Google sign-in (Google Cloud Console)

1. Open [console.cloud.google.com](https://console.cloud.google.com/) and create or choose a
   project.
2. Open **Google Auth Platform**. Search for it in the console, or go to **APIs & Services →
   OAuth consent screen**, which leads there. The first time, it asks for an app name, a
   support email and an audience. Choose **External**.
3. Open **Clients → Create client** and choose **Web application**. Add these under
   **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://YOUR-DOMAIN/api/auth/google/callback` (your live address)
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Under **Audience**, while the app is in *Testing*, only test users you add can sign in.
   Add yourself, or **Publish app** when you go live. The app only asks for `openid`,
   `email` and `profile`, which don't need Google's sensitive-scope review.

`APP_URL` must match the address customers use, because the redirect URI is built from it.
Sign-in is a standard OpenID Connect authorization-code flow with PKCE, state and nonce.
Google's ID token signature, issuer, audience and expiry are all verified, and only Google
accounts with a verified email can sign in. Sessions are random tokens. Only their SHA-256
hash is stored, in the `sessions` table.

The sign-in button is a plain text button in the shop's own style. If you want Google's
branded button, Google's [sign-in branding guidelines](https://developers.google.com/identity/branding-guidelines)
have the approved assets, and you can drop one into `src/app/signin/page.tsx`.

## 3. Mailgun

1. In Mailgun, add a sending domain, ideally a subdomain such as `mg.yourdomain.com`. Choose
   the **US** or **EU** region and remember which.
2. Add the DNS records Mailgun shows (SPF, DKIM, MX, tracking CNAME) at your DNS provider,
   then click **Verify**.
3. Go to **Send → Sending → Domain settings → Sending API keys → Add sending key**. A
   sending key can only send mail for that domain, so it's safer than your account key.
4. Fill in:
   ```
   MAILGUN_API_KEY=...            # the sending key
   MAILGUN_DOMAIN=mg.yourdomain.com
   MAILGUN_FROM="Your Shop <orders@mg.yourdomain.com>"
   MAILGUN_REGION=us              # or eu
   ```

While testing, Mailgun's sandbox domain only delivers to **authorized recipients** you add
in Mailgun. To check sending, place an order and look at Mailgun's **Logs**, or run
`select status, error, to_email from email_log order by created_at desc;`.

## Deploying to Vercel

1. Push the project to GitHub, then **Add New → Project** in Vercel and import it.
2. Add every variable from `.env.example` under **Settings → Environment Variables**, with
   `APP_URL` set to your live address (for example `https://ilearo.vercel.app`).
3. Deploy, then open `/api/health`.
4. Add the live callback URL to your Google client (step 2.3 above).
5. Optional: under **Settings → Functions**, pick the region closest to your database.

Any host that runs Node 20.9+ works too (Render, Railway, a VPS): `npm run build && npm start`.

## Changing the shop

| To change | Edit |
| --- | --- |
| Products, prices, descriptions | Rows in the `products` table (Supabase Table Editor / Neon tables), or `db/seed.sql`, then `npm run db:setup` |
| Product photos | Set `image_url` on a product (for example a public Supabase Storage URL). It replaces the generated pattern |
| Hide a product | Set `active = false` |
| Shop name and description | `src/lib/shop.ts` |
| Delivery fees, zones, free-delivery threshold | `src/lib/shipping.ts` |
| Categories and technique descriptions | `src/lib/catalog.ts` (and the check constraints in `db/schema.sql`) |
| Colours and fonts | `src/app/globals.css` |
| Bank transfer details | `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` (leave empty to offer pay on delivery only) |
| Email wording | `src/lib/email/order-confirmation.ts` |

Order handling happens in the database for now, for example:

```sql
update orders set payment_status = 'paid', status = 'processing' where reference = 'IA-7K3M9Q';
update orders set status = 'shipped' where reference = 'IA-7K3M9Q';
```

Customers see the new status on their order page.

## How the code is laid out

```
db/schema.sql, db/seed.sql     tables and sample catalogue
scripts/db-setup.ts            npm run db:setup
src/app/                       pages, plus server actions next to the pages that use them
  api/auth/google/             sign-in start and callback routes
  api/health/                  database check
  checkout/actions.ts          validates the form, places the order, schedules the email
src/lib/
  db.ts, db-url.ts             Postgres client (Supabase/Neon-safe settings)
  auth/oidc.ts, session.ts     Google OpenID Connect and database sessions
  cart.ts, orders.ts           cart storage and the order transaction
  email/                       Mailgun client, the confirmation template, sending and logging
  shipping.ts, money.ts, ...   small pure helpers (all unit-tested)
src/components/adire/art.tsx   the generated adire patterns
tests/unit/                    Vitest
tests/e2e/                     Playwright, with local stand-ins for Google and Mailgun
```

## Tests

```bash
npm run check        # lint + type check + unit tests
npm run test:e2e     # builds, then runs the browser tests
```

The browser tests need a Postgres server. By default they use
`postgresql://postgres:postgres@127.0.0.1:5432/ile_aro_test`. They create that database and
wipe it on every run, so never point `TEST_DATABASE_URL` at real data. Run
`npx playwright install chromium` once beforehand. They never contact Google or Mailgun.
Small local stand-ins (`tests/e2e/mock-services.mjs`) speak the same protocols. They cover:

- browsing and filtering, the cart (including stock limits and items that sell out), and
  the guest-to-account cart merge
- the full checkout: validation messages, totals, stock reduction, the order page, and the
  email contents (with customer input escaped)
- free delivery, re-checking stock at the moment of ordering, two shoppers racing for the
  last item, and double-submitted forms
- sign-in attacks: forged or missing state, tokens for the wrong app, wrong issuer, replayed
  nonce, expired tokens, unverified emails and open redirects; plus private orders,
  sign-out and session expiry
- a Mailgun outage (the order still succeeds and the failure is logged), WCAG 2.2 AA checks
  with axe, the phone menu, and horizontal overflow on phones

## Not included yet

- **Card payments.** Paystack or Flutterwave would fit into the checkout's payment step.
- **An admin screen.** Orders and products are managed in the database for now (see above).
- **One currency.** Prices are naira, stored in kobo.
