/**
 * The address of the shop's website. The app uses that site's API, so the
 * website and the app share one database, one account per Google user, and
 * one cart. Set it in mobile/.env (see .env.example), then restart Expo.
 */
const raw = (process.env.EXPO_PUBLIC_SHOP_URL ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");

export const SHOP_URL: string | null = /^https?:\/\/[^/\s]+$/.test(raw) ? raw : null;

/** The shop's host name for display, e.g. "ilearohng.netlify.app". */
export const SHOP_HOST = SHOP_URL ? SHOP_URL.replace(/^https?:\/\//, "") : "";

/** Turns an address from the API (often relative, like /api/v1/art/…) into a full URL. */
export function shopUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SHOP_URL ?? ""}${path.startsWith("/") ? "" : "/"}${path}`;
}
