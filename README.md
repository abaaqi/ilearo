# Ile Aro: an online shop for hand-dyed adire

A complete small shop: a catalogue, a cart, a checkout page, order history, Google
sign-in, order confirmation emails through Mailgun, and a Postgres database that can be
hosted on either **Supabase** or **Neon**.

It also has a **mobile app** for Android and iPhone (in [`mobile/`](mobile)), built with
Expo and React Native. The app uses the website's own API, so a shopper's Google account
is the same account in both places, and their cart is shared live: add something on the
website and it appears in the app within about a second. See [The mobile app](#the-mobile-app).

The brand ("Ile Aro") and the 14 products are sample content. Swapping in your own
catalogue doesn't need code changes; see [Changing the shop](#changing-the-shop).

![Home page](docs/home.jpg)

| Checkout | Order placed | Confirmation email |
| --- | --- | --- |
| ![Checkout](docs/checkout.jpg) | ![Order confirmation](docs/order.jpg) | ![Email](docs/email.jpg) |

![A hat added on the website appears in the app at once](docs/app/sync.jpg)

| App: shop | Product | Cart | Checkout | Order |
| --- | --- | --- | --- | --- |
| ![Shop](docs/app/shop.jpg) | ![Product](docs/app/product.jpg) | ![Live cart](docs/app/cart-live.jpg) | ![Checkout](docs/app/checkout.jpg) | ![Order](docs/app/order.jpg) |

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
- **Mobile app.** Shop, product pages, cart, checkout, orders and account, signed in with
  the same Google account as the website. The cart updates live in both directions.
- **API.** A JSON API under `/api/v1` for the app. It calls the same code as the website's
  pages and forms, so the rules, prices, stock checks and messages are identical.

**Tech stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript (strict),
Tailwind CSS 4, [postgres.js](https://github.com/porsager/postgres), [jose](https://github.com/panva/jose)
for verifying Google's ID tokens, and zod. The app uses Expo SDK 57 (React Native 0.86,
Expo Router). Tests use Vitest and Playwright.

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
- `GET /api/health` is a setup check. It reports whether the database works, whether
  `APP_URL` matches the address you opened it on, and which of Google, Mailgun and bank
  transfer are configured. When something is wrong, its `toFix` list says what to change.
  It never shows secret values.

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

## Deploying

Whichever host you use, the steps are the same:

1. **Updating an existing shop?** Run `npm run db:setup` against your database first (with
   `DATABASE_URL` in `.env.local`). It's safe to run again: it adds what new versions need,
   such as the live cart and app sign-in tables, and keeps your products, carts and orders.
   Use `npm run db:setup -- --no-seed` to leave the products alone too. Older versions of
   the site keep working with the updated database, so do this before deploying.
2. Add every variable from `.env.example` to the host, with `APP_URL` set to the live
   address (for example `https://your-site.netlify.app`, no trailing slash).
3. Deploy. If you change a variable later, **deploy again**: hosts only apply new values on
   a new deploy.
4. Open `/api/health` on the live site and fix anything in its `toFix` list.
5. Add the live callback URL to your Google client (step 2.3 above).

Paste values without quotes. The app removes a pair of quotes copied from a `.env` file,
but other characters around the value will break it.

Only three variables are secrets: `DATABASE_URL`, `GOOGLE_CLIENT_SECRET` and
`MAILGUN_API_KEY`. The rest are public anyway: they're shown on the site, in emails or in
Google's sign-in address. Never commit `.env.local` or the `client_secret_….json` file
Google lets you download (`.gitignore` already excludes both).

**Netlify.** Import the GitHub repository. Netlify recognises Next.js and needs no
`netlify.toml`. Add the variables under **Site configuration** (called **Project
configuration** in newer accounts) **→ Environment variables → Add a variable → Import
from a .env file**.
Paste your `.env.local` there, with `APP_URL` changed, and keep **All scopes** selected.
Variables written in `netlify.toml` don't reach the server functions, so don't put them
there. Netlify stops any request that runs longer than 10 seconds, which is why the app
gives up connecting to the database after 8.

Netlify also scans every build for the values of variables marked **Contains secret
values**, and stops the build if one appears in your repo or build files. Mark only the
three secrets above. If you've already marked others, add one more variable to tell the
scan to skip them:

```
SECRETS_SCAN_OMIT_KEYS=APP_URL,SHOP_SUPPORT_EMAIL,MAILGUN_FROM,MAILGUN_DOMAIN,MAILGUN_REGION,GOOGLE_CLIENT_ID,BANK_NAME,BANK_ACCOUNT_NAME,BANK_ACCOUNT_NUMBER
```

If the scan finds one of the three real secrets in a file in your repo, delete it from the
repo and replace the secret: create a new one with Google, Mailgun or your database host.
Treat anything pushed to GitHub as already seen.

**Vercel.** Use **Add New → Project** to import the repository, and add the variables under
**Settings → Environment Variables**. Under **Settings → Functions** you can pick the region
closest to your database.

Any host that runs Node 20.9+ also works (Render, Railway, a VPS): `npm run build && npm start`.

If the live site shows "This page didn't load" or "The shop can't load right now", open
`/api/health`. The usual causes are a missing or mistyped `DATABASE_URL`, a variable added
without redeploying, or Supabase's direct connection string used instead of the Transaction
pooler.

## The mobile app

The app is in [`mobile/`](mobile), an [Expo](https://expo.dev) (React Native) project for
Android and iPhone. It has no backend of its own: it uses this website's API, which reads
and writes the same database.

**One account.** "Continue with Google" in the app opens the website's own Google sign-in in
the phone's browser, with the same Google client. The same Google account always maps to
the same `users` row, so the website and the app are one account. Nothing needs adding in
Google Cloud: the app uses the website's existing redirect URI. When Google sends the
browser back, the website hands the app a one-time code (`ilearo://auth?code=…`), which the
app swaps for its own session token. PKCE ties the code to the app that asked for it, so an
intercepted code is useless. App sessions live in the same `sessions` table as website
sessions (only a hash of the token is stored), last 90 days and are renewed while the app is
used. The website's account page says how many phones are signed in.

**One cart, live.** A signed-in shopper has one cart, shared by the website and the app. A
database trigger gives the cart a new version number on every change, whichever side made
it. While the app is open, it keeps one request waiting on `/api/v1/cart/changes`. The
server checks the cart's version every 0.4 seconds and answers as soon as it changes, and
the app asks again straight away. So an item added on the website appears in the app within
about a second, with a banner saying where the change came from. Signed-in website tabs
listen the same way, so changes made in the app show up on the website without a reload.
Each request waits at most 8 seconds, inside Netlify's 10-second limit. Each open app, and
each signed-in website tab while it's visible, keeps one such request open at a time, which
counts towards your host's function usage.

Signed-out shoppers can use the app too. Their cart is kept on the server and joins their
account's cart when they sign in, as it does on the website.

### Try it on your phone

You need the website deployed with this version (see [Deploying](#deploying), including
`npm run db:setup`). Open `/api/health` on the live site and check it says
`"mobileApp": "ready"`.

1. Install **Expo Go** on your phone from the Play Store or the App Store.
2. On your computer:
   ```bash
   cd mobile
   npm install
   cp .env.example .env        # then set EXPO_PUBLIC_SHOP_URL to your live site
   npx expo start
   ```
   `EXPO_PUBLIC_SHOP_URL` is the website's address, the same as `APP_URL`, for example
   `https://ilearohng.netlify.app`.
3. Connect your phone to the same Wi-Fi as your computer. On Android, scan the QR code with
   Expo Go. On iPhone, scan it with the Camera app.

If the phone can't connect to the computer (some office and hotel Wi-Fi blocks this), turn
on your phone's hotspot and connect the computer to it. Don't use `npx expo start --tunnel`:
the website only sends sign-ins back to Expo Go on a private network address, so a
stranger's Expo Go can't receive yours.

### Phone test checklist

**Signing in, same account**

1. On your computer, sign in to the website with Google.
2. In the app, open **Account → Continue with Google** and choose the same Google account.
   On iPhone, allow "Expo Go wants to use … to sign in".
3. The app shows your name and email and says it's the same account as the website. Orders
   you placed on the website are listed.
4. Reload the website's account page: it now says the app is signed in on 1 phone.

**Cart synchronisation**

5. In the app, open the **Cart** tab. The line under the title should say **Live with**
   your site.
6. On the website, add a product to your cart.
7. Within about a second, without touching the phone, the item appears in the app's cart,
   a banner says "On the website: … added", and the Cart tab's badge goes up.
8. Change the quantity, or remove the item, on the website: the app follows.
9. Change the quantity in the app: the website's cart page and header update by themselves.
10. Optional: check out in the app. The order appears on the website's account page and
    the confirmation email arrives.

If something doesn't work:

| What you see | What to do |
| --- | --- |
| "Point the app at your shop" | Create `mobile/.env` from `.env.example`, then stop and restart `npx expo start`. |
| "Can't reach the shop" | Check `EXPO_PUBLIC_SHOP_URL`, and open that address in the phone's browser. |
| "This sign-in link isn't one we recognise" | The phone and computer aren't on the same network, or Expo is in tunnel mode. |
| Google: "Access blocked" or "has not completed verification" | In Google Auth Platform → Audience, add the Google account as a test user, or publish the app. |
| The cart doesn't update | Open `/api/health`: `mobileApp` must say `ready` (run `npm run db:setup`). Check the app and website show the same email. |

### Installing it as a real app

Expo Go is for trying the app out. To install it like any other app, build it with
[EAS Build](https://docs.expo.dev/build/introduction/) (free Expo account needed):

```bash
cd mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview    # an .apk you can install on Android phones
```

Set your site's address in `mobile/eas.json` first (`EXPO_PUBLIC_SHOP_URL`). A built app
signs in through `ilearo://auth`, which the website already accepts. iPhone builds need an
Apple Developer account.

## The API

All under `/api/v1`, JSON in and out. The app sends `Authorization: Bearer <token>` when
signed in, or `X-Guest-Cart: <id>` for a signed-out cart. Changes are only accepted with
those headers, never with website cookies, so other websites can't change a shopper's cart.

| Endpoint | What it does |
| --- | --- |
| `GET /shop` | Categories, techniques, states and delivery zones, payment options |
| `GET /products?category=` | Products for sale, in shop order |
| `GET /products/:slug` | One product, with related pieces |
| `GET /art/v1/:pattern-:tone-:seed.svg` | A product's generated pattern as an SVG file (cached for good) |
| `GET /cart` | The cart, with live prices, stock and problems |
| `POST /cart/items` | Add `{ productId, quantity }`; same rules and messages as the website |
| `PUT /cart/items/:productId` | Set `{ quantity }` (0 removes it) |
| `DELETE /cart/items/:productId` | Remove it |
| `GET /cart/changes?after=<version>` | The live feed: answers when the cart's version differs from `after` |
| `GET /checkout` | Contact details, delivery details from the last order, ways to pay |
| `POST /orders` | Place the order: `201 { reference, cart }`, `422` with `fieldErrors`, or `409` if stock changed |
| `GET /orders`, `GET /orders/:reference` | The shopper's orders |
| `GET /me` | The signed-in shopper |
| `POST /auth/token` | Swap the one-time sign-in code and PKCE verifier for an app session |
| `POST /auth/sign-out` | End this app session |

The app starts sign-in at `/api/auth/google?client=app&redirect_uri=…&code_challenge=…`,
the website's own sign-in route.

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
db/schema.sql, db/seed.sql     tables (including the cart version trigger) and sample catalogue
scripts/db-setup.ts            npm run db:setup
src/app/                       pages, plus server actions next to the pages that use them
  api/auth/google/             sign-in start and callback routes (website and app)
  api/v1/                      the JSON API used by the mobile app
  api/health/                  setup check (database, APP_URL, integrations)
  checkout/actions.ts          the checkout form's server action
src/lib/
  db.ts, db-url.ts             Postgres client (Supabase/Neon-safe settings)
  auth/oidc.ts, session.ts     Google OpenID Connect; web and app sessions
  auth/app-sign-in.ts          handing a sign-in to the app (one-time codes, PKCE)
  cart.ts, checkout.ts         cart rules and checking out, shared by the website and the API
  orders.ts                    the order transaction
  api.ts, art-svg.ts           API helpers and response shapes; swatches as SVG files
  email/                       Mailgun client, the confirmation template, sending and logging
  shipping.ts, money.ts, ...   small pure helpers (all unit-tested)
src/components/adire/art.tsx   the generated adire patterns
src/components/live-cart.tsx   keeps a signed-in website tab in step with the app
mobile/                        the Expo app (its own package.json; see mobile/README.md)
tests/unit/                    Vitest
tests/e2e/                     Playwright, with local stand-ins for Google and Mailgun
```

## Tests

```bash
npm run check        # lint + type check + unit tests
npm run test:e2e     # builds, then runs the browser tests
npm run test:app     # builds the mobile app for a browser, then tests it at phone size
cd mobile && npm run check   # the app's type check and lint
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
- the app's sign-in: the same Google account gives the same user on both sides, codes work
  once and only with the right PKCE verifier, sign-ins are never sent to websites or to
  Expo Go on public addresses, and app tokens and website cookies only work where issued
- the API: catalogue, cart rules and messages, guest carts joining an account, checkout,
  and refusing changes that come with website cookies
- live sync: a cart change on the website reaches the app's feed within a second, and the
  open website follows changes made in the app
- the app itself (`npm run test:app`): its web build at phone size against the real API,
  including Google sign-in, the cart updating live while the website changes it, checkout,
  and sign-out

The app's web build is only used for these tests. The app is made for phones, and the live
site doesn't allow other websites to call its API, so `npx expo start --web` against your
live site won't load products.

## Not included yet

- **Card payments.** Paystack or Flutterwave would fit into the checkout's payment step.
- **Push notifications.** The app hears about cart changes while it's open. Telling a closed
  app about an order's progress would need Expo push notifications.
- **An admin screen.** Orders and products are managed in the database for now (see above).
- **One currency.** Prices are naira, stored in kobo.
