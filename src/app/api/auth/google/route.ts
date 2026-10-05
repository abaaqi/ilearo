import { NextResponse, type NextRequest } from "next/server";
import { appUrl, googleSettings, usesHttps } from "@/lib/env";
import {
  buildAuthorizationUrl,
  encodePendingSignIn,
  oidcProvider,
  pkceChallenge,
  randomToken,
  safeReturnTo,
  usingMockGoogle,
  type AppSignIn,
} from "@/lib/auth/oidc";
import { isAllowedAppRedirect, isCodeChallenge } from "@/lib/auth/app-redirect";
import { redirectToApp } from "@/lib/auth/app-sign-in";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/lib/auth/constants";

/**
 * Step 1 of Google sign-in: remember who's signing in, then hand over to Google.
 *
 * The mobile app uses this same route in the phone's browser, adding
 * client=app, redirect_uri (where to send the result) and code_challenge
 * (its PKCE challenge). See src/lib/auth/app-sign-in.ts.
 */
export async function GET(request: NextRequest) {
  const base = appUrl();
  const params = request.nextUrl.searchParams;
  const returnTo = safeReturnTo(params.get("returnTo"));

  let app: AppSignIn | undefined;
  if (params.get("client") === "app") {
    const redirectUri = params.get("redirect_uri");
    const codeChallenge = params.get("code_challenge");
    if (!isAllowedAppRedirect(redirectUri, { testing: usingMockGoogle() }) || !isCodeChallenge(codeChallenge)) {
      return badAppRequest();
    }
    app = { redirectUri, codeChallenge };
  }

  // The cookie must be set on the same host Google will send people back to.
  // Hop to the canonical address once if someone arrived on another one.
  const canonical = new URL(base);
  if (request.nextUrl.host !== canonical.host && !params.has("hop")) {
    const url = new URL("/api/auth/google", base);
    for (const [key, value] of params) url.searchParams.set(key, value);
    url.searchParams.set("returnTo", returnTo);
    url.searchParams.set("hop", "1");
    return NextResponse.redirect(url);
  }

  const google = googleSettings();
  if (!google) {
    if (app) return redirectToApp(app.redirectUri, { error: "not_configured" });
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
  response.cookies.set(OAUTH_COOKIE, encodePendingSignIn({ state, nonce, verifier, returnTo, ...(app ? { app } : {}) }), {
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function badAppRequest(): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in link not recognised</title></head>
<body style="font-family:system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#141c45;background:#eef2f8">
<h1 style="font-size:1.5rem">This sign-in link isn't one we recognise</h1>
<p>Close this window and tap <strong>Continue with Google</strong> in the Ile Aro app again.</p>
<p style="color:#4d6299;font-size:.9rem">If you're running the app in Expo Go, your phone and computer need to be on the same Wi-Fi network (not a tunnel).</p>
</body></html>`;
  return new Response(body, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
