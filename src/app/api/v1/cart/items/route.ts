import { z } from "zod";
import { ApiError, apiCaller, apiCart, apiJson, apiRoute, readJson } from "@/lib/api";
import { addItem, loadCart, type CartOwner } from "@/lib/cart";
import { MAX_PER_ITEM } from "@/lib/catalog";

const addSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_PER_ITEM).default(1),
});

/**
 * POST /api/v1/cart/items {"productId": "…", "quantity": 1}
 *
 * Adds to the cart with the website's rules. A refusal (sold out, already at
 * the limit) still answers 200 with ok: false and the message to show.
 * Signed-out callers get a guest cart; keep `guestCartId` and send it back in
 * X-Guest-Cart.
 */
export const POST = apiRoute(async (request) => {
  const caller = await apiCaller(request);
  const parsed = addSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, `Send a productId and a quantity from 1 to ${MAX_PER_ITEM}.`);

  const result = await addItem(caller.owner, parsed.data.productId, parsed.data.quantity, caller.client);
  // A signed-out caller's cart may have just been created, so follow it by its id.
  const owner: CartOwner = caller.user || !result.cart ? caller.owner : { guestCartId: result.cart.id };
  const cart = await loadCart(owner);
  return apiJson({
    ok: result.ok,
    message: result.message,
    cart: apiCart(cart),
    ...(caller.user ? {} : { guestCartId: cart.id }),
  });
});
