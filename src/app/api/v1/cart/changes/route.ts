import { ApiError, apiCaller, apiCart, apiJson, apiRoute } from "@/lib/api";
import { findCart, loadCart } from "@/lib/cart";

/**
 * Hosting platforms cut requests off after about 10 seconds (Netlify's limit),
 * so a request waits at most this long. Callers simply ask again.
 */
const MAX_WAIT_SECONDS = 8;
/** How often a waiting request checks the cart's version. */
const CHECK_EVERY_MS = 400;

/**
 * GET /api/v1/cart/changes?after=<version>
 *
 * The live cart feed. Answers straight away with the full cart if its
 * version differs from `after`. Otherwise it waits, checking every 400 ms,
 * and answers as soon as the cart changes (or with changed: false after
 * 8 seconds). Ask again with the version you now hold and changes made on
 * the website reach the app within about half a second, and the other way
 * round.
 *
 * Every change to a cart's items gets a new version from a database trigger,
 * so it doesn't matter which code, or which client, made the change.
 */
export const GET = apiRoute(async (request) => {
  const caller = await apiCaller(request, { cookies: true });
  const params = request.nextUrl.searchParams;

  const afterParam = params.get("after");
  const after = afterParam === null ? null : Number(afterParam);
  if (after !== null && (!Number.isSafeInteger(after) || after < 0)) {
    throw new ApiError(400, "after must be the cart version you have, such as 0.");
  }
  const waitParam = Number(params.get("wait") ?? MAX_WAIT_SECONDS);
  const waitMs = (Number.isFinite(waitParam) ? Math.min(Math.max(waitParam, 0), MAX_WAIT_SECONDS) : MAX_WAIT_SECONDS) * 1000;
  const deadline = Date.now() + waitMs;

  const currentVersion = async () => (await findCart(caller.owner))?.version ?? 0;
  let version = await currentVersion();
  while (after !== null && version === after && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(CHECK_EVERY_MS, Math.max(deadline - Date.now(), 0))));
    // Stop asking the database once the app or browser has hung up.
    if (request.signal.aborted) return apiJson({ changed: false, version });
    version = await currentVersion();
  }

  if (after !== null && version === after) return apiJson({ changed: false, version });
  return apiJson({ changed: true, cart: apiCart(await loadCart(caller.owner)) });
});
