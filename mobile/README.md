# Ile Aro mobile app

The shop's app for Android and iPhone, built with [Expo](https://expo.dev) SDK 57
(React Native 0.86, Expo Router). It has no backend of its own: it talks to the shop's
website through its API (`/api/v1`), so it shares the website's database, accounts and
carts. The main [README](../README.md#the-mobile-app) explains how sign-in and the live
cart work, and has the full phone test checklist.

## Run it on your phone

The website must be deployed with the version that includes the API, and its database
updated with `npm run db:setup`. Check `https://your-site/api/health` says
`"mobileApp": "ready"`.

```bash
npm install
cp .env.example .env    # set EXPO_PUBLIC_SHOP_URL to the website's address (same as APP_URL)
npx expo start
```

Install **Expo Go** on your phone, put the phone on the same Wi-Fi as the computer, and
scan the QR code (Expo Go on Android, the Camera app on iPhone). Don't use `--tunnel`:
sign-in only returns to Expo Go on a private network address. If the Wi-Fi blocks phones
from reaching the computer, connect the computer to the phone's hotspot instead.

## What's where

```
src/app/                 screens (Expo Router: the file path is the route)
  (tabs)/index.tsx       Shop
  (tabs)/cart.tsx        Cart, with the live status line
  (tabs)/account.tsx     Account, orders, sign in and out
  products/[slug].tsx    A product
  checkout.tsx           Checkout
  orders/[reference].tsx An order
  auth.tsx               Where sign-in lands (ilearo://auth?code=…)
src/state/
  session.tsx            Google sign-in through the website, the session token
  cart.tsx               The cart and its live feed from the server
  shop.tsx               Categories, states, delivery zones
src/lib/api.ts           Every call to the website's API
src/ui/                  Shared components and the indigo theme
assets/                  Icons and the cloth textures laid over product patterns
```

## Checks

```bash
npm run check            # TypeScript and ESLint
npm run export:native    # bundles the app for Android and iOS, to catch build problems
```

The website project runs the app in a phone-sized browser against the real API with
`npm run test:app`.

## Building an installable app

Expo Go is for development. To build an app you can install like any other, use
[EAS Build](https://docs.expo.dev/build/introduction/): set your site's address in
`eas.json`, then

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # an .apk for Android phones
```

Built apps sign in through the `ilearo://auth` link, which the website already accepts.
iPhone builds need an Apple Developer account.
