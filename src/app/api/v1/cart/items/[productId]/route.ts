import { z } from "zod";
import { ApiError, apiCaller, apiCart, apiJson, apiRoute, readJson } from "@/lib/api";
import { changeQuantity, loadCart, removeItem } from "@/lib/cart";
import { MAX_PER_ITEM } from "@/lib/catalog";

type Context = { params: Promise<{ productId: string }> };

const quantitySchema = z.object({ quantity: z.number().int().min(0).max(MAX_PER_ITEM) });

/**
 * PUT /api/v1/cart/items/:productId {"quantity": 2}: the − and + buttons.
 * Going down is always allowed; going up only while stock lasts. 0 removes it.
 */
export const PUT = apiRoute<Context>(async (request, { params }) => {
  const caller = await apiCaller(request);
  const parsed = quantitySchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, `Send a quantity from 0 to ${MAX_PER_ITEM}.`);
  const result = await changeQuantity(caller.owner, (await params).productId, parsed.data.quantity, caller.client);
  return apiJson({ ok: result.ok, message: result.message, cart: apiCart(await loadCart(caller.owner)) });
});

/** DELETE /api/v1/cart/items/:productId: takes it out of the cart. */
export const DELETE = apiRoute<Context>(async (request, { params }) => {
  const caller = await apiCaller(request);
  const result = await removeItem(caller.owner, (await params).productId, caller.client);
  return apiJson({ ok: result.ok, message: result.message, cart: apiCart(await loadCart(caller.owner)) });
});
