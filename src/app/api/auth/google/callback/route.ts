import { NextResponse, type NextRequest } from "next/server";
import { appUrl, googleSettings, usesHttps } from "@/lib/env";
import {
  SignInError,
  constantTimeEqual,
  decodePendingSignIn,
  exchangeCode,
  oidcProvider,
  verifyIdToken,
} from "@/lib/auth/oidc";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/lib/auth/constants";
import { createSession, sessionCookie } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/users";
import { CART_COOKIE, mergeGuestCart } from "@/lib/cart";

/** Step 2 of Google sign-in: Google sends the shopper back here with a one-time code. */
export async function GET(request: NextRequest) {
  const base = appUrl();
  const params = request.nextUrl.searchParams;
  const pending = decodePendingSignIn(request.cookies.get(OAUTH_COOKIE)?.value);

  const finish = (response: NextResponse) => {
    // The pending sign-in is single-use, whatever happens next.
    response.cookies.set(OAUTH_COOKIE, "", {
      httpOnly: true,
      secure: usesHttps(),
      sameSite: "lax",
      path: OAUTH_COOKIE_PATH,
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const fail = (code: string) => {
    const url = new URL("/signin", base);
    url.searchParams.set("error", code);
    if (pending?.returnTo && pending.returnTo !== "/") url.searchParams.set("returnTo", pending.returnTo);
    return finish(NextResponse.redirect(url));
  };

  if (!pending) return fail("expired");
  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "cancelled" : "google");

  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code || !constantTimeEqual(state, pending.state)) return fail("state");

  const google = googleSettings();
  if (!google) return fail("not_configured");

  try {
    const provider = oidcProvider();
    const idToken = await exchangeCode(provider, {
      code,
      codeVerifier: pending.verifier,
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      redirectUri: google.redirectUri,
    });
    const profile = await verifyIdToken(idToken, { provider, clientId: google.clientId, nonce: pending.nonce });
    if (!profile.emailVerified) return fail("unverified");

    const userId = await upsertGoogleUser(profile);
    const session = await createSession(userId, request.headers.get("user-agent"));

    const guestCart = request.cookies.get(CART_COOKIE)?.value;
    if (guestCart) await mergeGuestCart(guestCart, userId);

    const response = NextResponse.redirect(new URL(pending.returnTo, base));
    response.cookies.set(sessionCookie(session.token, session.expires));
    if (guestCart) response.cookies.set(CART_COOKIE, "", { path: "/", maxAge: 0 });
    return finish(response);
  } catch (error) {
    console.error(
      "[auth] Google sign-in failed:",
      error instanceof SignInError ? `${error.code}: ${error.message}` : error,
    );
    return fail("google");
  }
}
