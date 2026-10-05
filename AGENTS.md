<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Online shop: Next.js App Router + Server Actions, Postgres via postgres.js (`src/lib/db.ts`), Google OpenID Connect sign-in (`src/lib/auth/`), Mailgun emails (`src/lib/email/`).
- Schema lives in `db/schema.sql` (idempotent); sample catalogue in `db/seed.sql`. Apply both with `npm run db:setup`.
- Money is integer kobo everywhere. Prices and stock always come from the database, never from forms.
- Orders are placed in one transaction in `src/lib/orders.ts` (cart row and product rows locked `for update`). Keep it that way.
- Before finishing a change: `npm run check` (lint, types, unit tests) and `npm run test:e2e` (needs local Postgres; see README).
- The header (`src/components/site-header.tsx`) is on every page and must never throw: it falls back to "signed out, empty cart" if the database fails. Pages that need the database surface errors through `src/app/error.tsx`.
- `/api/health` is the setup checker (`src/lib/db-diagnostics.ts` explains database errors). Keep it free of secret values.
- The mobile app (`mobile/`, Expo) uses the JSON API in `src/app/api/v1/`. Cart and checkout rules live in `src/lib/cart.ts` and `src/lib/checkout.ts` and are shared by the website's server actions and the API: change them there, never in one caller.
- Every change to `cart_items` bumps `carts.version` through a database trigger; the live feed (`/api/v1/cart/changes`) depends on it. Set the client (`web`/`app`) with `changeCart` or `set_config('ile_aro.client', …, true)` inside the transaction.
- App sign-in reuses `/api/auth/google` with `client=app`; redirect targets are limited by `src/lib/auth/app-redirect.ts` (custom scheme or Expo Go on a private network only). API changes are never accepted on cookies alone.
