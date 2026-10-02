/** Short-lived cookie holding the state, nonce and PKCE verifier during Google sign-in. */
export const OAUTH_COOKIE = "ia_oauth";
/** Scoped to the sign-in routes so it is never sent anywhere else. */
export const OAUTH_COOKIE_PATH = "/api/auth/google";
