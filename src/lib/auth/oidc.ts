/**
 * Google sign-in, implemented as a standard OpenID Connect authorization-code
 * flow with PKCE:
 *
 *   1. /api/auth/google creates a random state, nonce and PKCE verifier,
 *      keeps them in a short-lived httpOnly cookie and sends the shopper to
 *      Google.
 *   2. Google sends them back to /api/auth/google/callback with a one-time
 *      code. We check the state, swap the code for tokens (proving we hold
 *      the client secret and the PKCE verifier), then verify the ID token's
 *      signature against Google's published keys and check its issuer,
 *      audience, expiry and nonce before trusting who it says the user is.
 *
 * This file has no Next.js imports so it can be unit tested on its own.
 */
import { base64url, createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { isAllowedAppRedirect, isCodeChallenge } from "./app-redirect";

export type OidcProvider = {
  issuers: string[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
};

/** Google's endpoints, from https://accounts.google.com/.well-known/openid-configuration */
export const GOOGLE_PROVIDER: OidcProvider = {
  issuers: ["https://accounts.google.com", "accounts.google.com"],
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
};

/**
 * The automated tests point sign-in at a local stand-in for Google by
 * setting GOOGLE_OAUTH_MOCK_URL. Leave it unset everywhere else.
 */
export function usingMockGoogle(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_MOCK_URL?.trim());
}

export function oidcProvider(): OidcProvider {
  const mock = process.env.GOOGLE_OAUTH_MOCK_URL?.trim();
  if (!mock) return GOOGLE_PROVIDER;
  const base = mock.replace(/\/+$/, "");
  return {
    issuers: [base],
    authorizationEndpoint: `${base}/authorize`,
    tokenEndpoint: `${base}/token`,
    jwksUri: `${base}/jwks`,
  };
}

export class SignInError extends Error {
  constructor(
    readonly code: "token_exchange" | "id_token" | "nonce" | "profile",
    message: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url.encode(bytes);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url.encode(new Uint8Array(digest));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SENTINEL_ORIGIN = "http://return-to.invalid";

/**
 * Only same-site paths are allowed as a post-sign-in destination, so the
 * sign-in link can't be used to bounce people to another website.
 */
export function safeReturnTo(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  try {
    const url = new URL(value, SENTINEL_ORIGIN);
    if (url.origin !== SENTINEL_ORIGIN) return fallback;
    if (url.pathname.startsWith("/api/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** A sign-in started by the mobile app: where to send it back, and the app's PKCE challenge. */
export type AppSignIn = { redirectUri: string; codeChallenge: string };

/** What we remember between sending someone to Google and their return. */
export type PendingSignIn = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  /** Present when the mobile app started this sign-in. */
  app?: AppSignIn;
};

export function encodePendingSignIn(pending: PendingSignIn): string {
  return base64url.encode(JSON.stringify(pending));
}

export function decodePendingSignIn(raw: string | undefined): PendingSignIn | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64url.decode(raw)));
    if (!value || typeof value !== "object") return null;
    const { state, nonce, verifier, returnTo, app } = value as Record<string, unknown>;
    if (typeof state !== "string" || typeof nonce !== "string" || typeof verifier !== "string") return null;
    const pending: PendingSignIn = { state, nonce, verifier, returnTo: safeReturnTo(returnTo) };
    if (app !== undefined) {
      // Checked again here, in case the cookie was tampered with.
      const { redirectUri, codeChallenge } = (app ?? {}) as Record<string, unknown>;
      if (!isAllowedAppRedirect(redirectUri, { testing: usingMockGoogle() }) || !isCodeChallenge(codeChallenge)) return null;
      pending.app = { redirectUri, codeChallenge };
    }
    return pending;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(
  provider: OidcProvider,
  params: { clientId: string; redirectUri: string; state: string; nonce: string; codeChallenge: string },
): string {
  const url = new URL(provider.authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Swaps the one-time code for tokens and returns the ID token. */
export async function exchangeCode(
  provider: OidcProvider,
  params: { code: string; codeVerifier: string; clientId: string; clientSecret: string; redirectUri: string },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(provider.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        code_verifier: params.codeVerifier,
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new SignInError("token_exchange", `Could not reach the token endpoint: ${(error as Error).message}`);
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new SignInError("token_exchange", `Token endpoint answered ${response.status}: ${String(body?.error ?? "no details")}`);
  }
  const idToken = body?.id_token;
  if (typeof idToken !== "string") throw new SignInError("token_exchange", "The token response had no id_token");
  return idToken;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

const keySets = new Map<string, JWTVerifyGetKey>();

function remoteKeys(jwksUri: string): JWTVerifyGetKey {
  let keys = keySets.get(jwksUri);
  if (!keys) {
    // Caches Google's signing keys and refetches when they rotate.
    keys = createRemoteJWKSet(new URL(jwksUri));
    keySets.set(jwksUri, keys);
  }
  return keys;
}

export async function verifyIdToken(
  idToken: string,
  params: { provider: OidcProvider; clientId: string; nonce: string; keys?: JWTVerifyGetKey },
): Promise<GoogleProfile> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, params.keys ?? remoteKeys(params.provider.jwksUri), {
      issuer: params.provider.issuers,
      audience: params.clientId,
      algorithms: ["RS256"],
      clockTolerance: 60,
      requiredClaims: ["sub", "iat", "exp"],
    }));
  } catch (error) {
    throw new SignInError("id_token", `ID token rejected: ${(error as Error).message}`);
  }

  if (typeof payload.nonce !== "string" || !constantTimeEqual(payload.nonce, params.nonce)) {
    throw new SignInError("nonce", "ID token nonce does not match this sign-in");
  }
  if (payload.azp !== undefined && payload.azp !== params.clientId) {
    throw new SignInError("id_token", "ID token was issued to a different client");
  }

  const { sub, email, email_verified: verified, name, picture } = payload as JWTPayload & Record<string, unknown>;
  if (typeof sub !== "string" || typeof email !== "string" || !email.includes("@")) {
    throw new SignInError("profile", "ID token has no email address");
  }

  return {
    sub,
    email,
    emailVerified: verified === true || verified === "true",
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    picture: typeof picture === "string" && picture.startsWith("https://") ? picture : null,
  };
}
