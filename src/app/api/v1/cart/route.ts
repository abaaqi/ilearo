import { apiCaller, apiCart, apiJson, apiRoute } from "@/lib/api";
import { loadCart } from "@/lib/cart";

/** GET /api/v1/cart: the caller's cart with live prices and stock. */
export const GET = apiRoute(async (request) => {
  const caller = await apiCaller(request, { cookies: true });
  return apiJson({ cart: apiCart(await loadCart(caller.owner)) });
});
