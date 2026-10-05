import { apiCaller, apiCart, apiError, apiJson, apiOrderSummary, apiRoute, readJson, requireUser } from "@/lib/api";
import { loadCart } from "@/lib/cart";
import { checkout } from "@/lib/checkout";
import { CHECKOUT_FIELDS, type CheckoutField } from "@/lib/checkout-schema";
import { listOrdersForUser } from "@/lib/orders";

/** GET /api/v1/orders: the shopper's orders, newest first, wherever they were placed. */
export const GET = apiRoute(async (request) => {
  const user = requireUser(await apiCaller(request, { cookies: true }));
  return apiJson({ orders: (await listOrdersForUser(user.id)).map(apiOrderSummary) });
});

/**
 * POST /api/v1/orders: checks out the cart, exactly as the website's checkout
 * form does (same validation, prices and stock from the database, same
 * confirmation email).
 *
 *   201 {"reference": "IA-7K3M9Q", "cart": {…}}   the cart, now empty
 *   422 {"error": "…", "fieldErrors": {"phone": "…"}}
 *   409 {"error": "…", "cartChanged": true}   stock ran out; show the cart again
 */
export const POST = apiRoute(async (request) => {
  const user = requireUser(await apiCaller(request));
  const body = await readJson(request);
  const values = Object.fromEntries(
    CHECKOUT_FIELDS.map((field) => [field, typeof body[field] === "string" ? body[field] : ""]),
  ) as Record<CheckoutField, string>;

  const outcome = await checkout(user, values, "app");
  const cart = async () => apiCart(await loadCart({ userId: user.id }));
  if (outcome.ok) return apiJson({ reference: outcome.reference, cart: await cart() }, 201);
  switch (outcome.reason) {
    case "invalid":
      return apiError(422, outcome.message, { fieldErrors: outcome.fieldErrors });
    case "stock":
      return apiError(409, outcome.message, { cartChanged: true });
    case "empty":
      // A second tap on "Place order" finds the cart already emptied by the first.
      return outcome.recentReference
        ? apiJson({ reference: outcome.recentReference, alreadyPlaced: true, cart: await cart() })
        : apiError(409, "Your cart is empty, so there's nothing to check out.", { cartChanged: true });
    case "failed":
      return apiError(503, outcome.message);
  }
});
