import { NextResponse, type NextRequest } from "next/server";
import { appUrl, googleSettings, usesHttps } from "@/lib/env";
import {
  buildAuthorizationUrl,
  encodePendingSignIn,
  oidcProvider,
  pkceChallenge,
  randomToken,
  safeReturnTo,
} from "@/lib/auth/oidc";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/lib/auth/constants";

/** Step 1 of Google sign-in: remember who's signing in, then hand over to Google. */
export async function GET(request: NextRequest) {
  const base = appUrl();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  // The cookie must be set on the same host Google will send people back to.
  // Hop to the canonical address once if someone arrived on another one.
  const canonical = new URL(base);
  if (request.nextUrl.host !== canonical.host && !request.nextUrl.searchParams.has("hop")) {
    const url = new URL("/api/auth/google", base);
    url.searchParams.set("returnTo", returnTo);
    url.searchParams.set("hop", "1");
    return NextResponse.redirect(url);
  }

  const google = googleSettings();
  if (!google) {
    const url = new URL("/signin", base);
    url.searchParams.set("error", "not_configured");
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const authorizationUrl = buildAuthorizationUrl(oidcProvider(), {
    clientId: google.clientId,
    redirectUri: google.redirectUri,
    state,
    nonce,
    codeChallenge: await pkceChallenge(verifier),
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_COOKIE, encodePendingSignIn({ state, nonce, verifier, returnTo }), {
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
