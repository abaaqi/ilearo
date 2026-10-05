import "server-only";
import { NextResponse } from "next/server";
import { db } from "../db";
import { constantTimeEqual, pkceChallenge, randomToken } from "./oidc";
import { hashToken } from "./session";
import { appRedirectUrl, isCodeVerifier } from "./app-redirect";

/**
 * Signing in on the mobile app, with the same Google account as the website:
 *
 *   1. The app makes a PKCE verifier and opens
 *      /api/auth/google?client=app&redirect_uri=…&code_challenge=…
 *      in the phone's browser. From there it is the website's own Google
 *      sign-in, with the same Google client, so it finds or creates the same
 *      users row the website uses.
 *   2. Instead of setting a website cookie, the callback stores a one-time
 *      code (hashed) and sends the browser to the app: ilearo://auth?code=…
 *   3. The app posts the code and its verifier to /api/v1/auth/token and gets
 *      its own session token. A code works once, for five minutes, and only
 *      with the verifier that matches the challenge from step 1.
 */

const CODE_LIFETIME_MINUTES = 5;

/**
 * Sends the phone's browser back into the app, e.g. ilearo://auth?code=…
 * Only call with a redirect URI that passed isAllowedAppRedirect.
 */
export function redirectToApp(redirectUri: string, params: Record<string, string>): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: appRedirectUrl(redirectUri, params), "Cache-Control": "no-store" },
  });
}

export async function createAppSignInCode(userId: string, codeChallenge: string): Promise<string> {
  const code = randomToken(32);
  const sql = db();
  await sql`
    insert into app_sign_in_codes (id, user_id, code_challenge, expires_at)
    values (${await hashToken(code)}, ${userId}, ${codeChallenge}, now() + make_interval(mins => ${CODE_LIFETIME_MINUTES}))
  `;
  await sql`delete from app_sign_in_codes where expires_at < now() - interval '1 day'`;
  return code;
}

/** The user a code was issued to, if the app proves it started this sign-in. The code is spent either way. */
export async function redeemAppSignInCode(code: unknown, codeVerifier: unknown): Promise<string | null> {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code) || !isCodeVerifier(codeVerifier)) return null;
  const sql = db();
  const [row] = await sql<{ userId: string; codeChallenge: string }[]>`
    update app_sign_in_codes set used_at = now()
    where id = ${await hashToken(code)} and used_at is null and expires_at > now()
    returning user_id, code_challenge
  `;
  if (!row) return null;
  return constantTimeEqual(await pkceChallenge(codeVerifier), row.codeChallenge) ? row.userId : null;
}
