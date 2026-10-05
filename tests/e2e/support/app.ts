import { createHash, randomBytes } from "node:crypto";
import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { MOCK_URL, type ACCOUNTS } from "./mocks";

/**
 * Plays the part of the mobile app: the same HTTP calls, in the same order,
 * that mobile/src/auth.tsx and mobile/src/api.ts make.
 */

export const BASE_URL = "http://localhost:3100";
export const APP_REDIRECT = "ilearo://auth";

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function pkcePair() {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

/** A fresh "phone": its own cookie jar, like the browser the app opens for sign-in. */
export function newPhone(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BASE_URL });
}

export function signInUrl(redirectUri: string, challenge: string): string {
  const url = new URL("/api/auth/google", BASE_URL);
  url.searchParams.set("client", "app");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  return url.toString();
}

/**
 * Runs the browser half of sign-in: our start route, the stand-in Google's
 * account chooser, our callback. Returns where the browser is finally sent,
 * e.g. ilearo://auth?code=…
 */
export async function browserSignIn(
  phone: APIRequestContext,
  account: keyof typeof ACCOUNTS | "cancel",
  options: { redirectUri?: string; challenge: string },
): Promise<URL> {
  const start = await phone.get(signInUrl(options.redirectUri ?? APP_REDIRECT, options.challenge), { maxRedirects: 0 });
  expect(start.status(), await start.text()).toBe(307);
  const authorize = new URL(start.headers().location!);
  expect(authorize.origin).toBe(MOCK_URL);

  let callback: URL;
  if (account === "cancel") {
    callback = new URL(authorize.searchParams.get("redirect_uri")!);
    callback.searchParams.set("error", "access_denied");
    callback.searchParams.set("state", authorize.searchParams.get("state")!);
  } else {
    const approve = new URL("/authorize/approve", MOCK_URL);
    for (const [key, value] of authorize.searchParams) approve.searchParams.set(key, value);
    approve.searchParams.set("account", account);
    const google = await phone.get(approve.toString(), { maxRedirects: 0 });
    expect(google.status()).toBe(302);
    callback = new URL(google.headers().location!);
  }

  const back = await phone.get(callback.toString(), { maxRedirects: 0 });
  expect(back.status()).toBe(303);
  return new URL(back.headers().location!);
}

export type AppSession = { token: string; user: { id: string; email: string; name: string | null } };

/** The whole app sign-in: browser half, then swapping the code for a session token. */
export async function appSignIn(
  phone: APIRequestContext,
  account: keyof typeof ACCOUNTS,
  extra: { guestCartId?: string } = {},
): Promise<AppSession> {
  const { verifier, challenge } = pkcePair();
  const landed = await browserSignIn(phone, account, { challenge });
  expect(`${landed.protocol}//${landed.host}`).toBe(APP_REDIRECT);
  const code = landed.searchParams.get("code");
  expect(code).toBeTruthy();
  const response = await phone.post("/api/v1/auth/token", {
    data: { code, codeVerifier: verifier, device: "Test phone", ...extra },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as AppSession;
}

export const bearer = (session: AppSession) => ({ Authorization: `Bearer ${session.token}` });
