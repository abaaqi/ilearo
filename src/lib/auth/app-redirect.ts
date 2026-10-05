/**
 * Rules for handing a finished Google sign-in from the phone's browser back
 * to the mobile app. No Next.js imports, so it can be unit tested on its own.
 */

/** The mobile app's own link scheme ("scheme" in mobile/app.json). */
export const APP_SCHEME = "ilearo";

/** Private network addresses, where Expo Go loads the app from during development. */
function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  // Plain decimal only. A leading zero ("010") is octal to some resolvers, so
  // 010.010.010.010 would look private here but reach 8.8.8.8 on the phone.
  const octet = "(0|[1-9]\\d{0,2})";
  const match = new RegExp(`^${octet}\\.${octet}\\.${octet}\\.${octet}$`).exec(hostname);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts as [number, number];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Where a sign-in may be sent back to:
 *
 *   ilearo://auth                      the installed app
 *   exp://192.168.1.20:8081/--/auth    the app running in Expo Go, loaded from a
 *                                      computer on the same private network
 *
 * Web addresses are never accepted, so a sign-in can't be redirected to a
 * website. The one-time code sent back is useless without the PKCE verifier
 * that only the app that started the sign-in holds.
 *
 * `testing` also allows http://localhost/auth, where the automated tests run
 * the app in a browser. It is only ever on with the stand-in Google.
 */
export function isAllowedAppRedirect(value: unknown, options: { testing?: boolean } = {}): value is string {
  if (typeof value !== "string" || value.length > 300) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.search || url.hash || url.username || url.password) return false;
  if (url.protocol === `${APP_SCHEME}:`) return url.host === "auth" && (url.pathname === "" || url.pathname === "/");
  if (url.protocol === "exp:" || url.protocol === "exps:") return isPrivateHost(url.hostname) && url.pathname === "/--/auth";
  if (options.testing && url.protocol === "http:") {
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.pathname === "/auth";
  }
  return false;
}

/** A PKCE S256 challenge: base64url of a SHA-256 digest. */
export function isCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** A PKCE verifier as RFC 7636 defines it. */
export function isCodeVerifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

/** The app's redirect address with the result added, e.g. ilearo://auth?code=… */
export function appRedirectUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
