import { ApiError, apiJson, apiRoute, apiUser, readJson } from "@/lib/api";
import { redeemAppSignInCode } from "@/lib/auth/app-sign-in";
import { createSession, type SessionUser } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart";
import { db, isUuid } from "@/lib/db";

/**
 * POST /api/v1/auth/token {"code": "…", "codeVerifier": "…", "guestCartId": "…"}
 *
 * The last step of signing in on the app (see src/lib/auth/app-sign-in.ts):
 * swaps the one-time code from ilearo://auth?code=… for an app session token.
 * A guest cart the app built before signing in joins the account's cart,
 * just as it does on the website.
 */
export const POST = apiRoute(async (request) => {
  const body = await readJson(request);
  const userId = await redeemAppSignInCode(body.code, body.codeVerifier);
  if (!userId) throw new ApiError(400, "That sign-in has expired or was already used. Try signing in again.");

  const device = typeof body.device === "string" ? body.device.slice(0, 120) : null;
  const session = await createSession(userId, device ? `Ile Aro app: ${device}` : "Ile Aro app", "app");
  if (isUuid(body.guestCartId)) await mergeGuestCart(body.guestCartId, userId, "app");

  const sql = db();
  const [user] = await sql<SessionUser[]>`select id, email, name, avatar_url from users where id = ${userId}`;
  if (!user) throw new ApiError(400, "That account no longer exists.");
  return apiJson({ token: session.token, expiresAt: session.expires.toISOString(), user: apiUser(user) });
});
