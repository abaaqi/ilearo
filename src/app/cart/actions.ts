"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addItem, changeQuantity, currentCartOwner, rememberGuestCart, removeItem } from "@/lib/cart";
import { MAX_PER_ITEM } from "@/lib/catalog";

// The rules and messages live in lib/cart.ts, shared with the mobile app's API.

export type AddToCartState =
  | { status: "idle" }
  | { status: "added" | "error"; message: string; at: number };

const addSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_PER_ITEM),
});

export async function addToCart(_previous: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const at = Date.now();
  const parsed = addSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity") ?? 1,
  });
  if (!parsed.success) {
    return { status: "error", message: `Choose a quantity from 1 to ${MAX_PER_ITEM}.`, at };
  }

  const result = await addItem(await currentCartOwner(), parsed.data.productId, parsed.data.quantity, "web");
  if (result.cart?.created) await rememberGuestCart(result.cart.id);
  if (result.ok) refresh();
  return { status: result.ok ? "added" : "error", message: result.message, at };
}

const lineSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(0).max(MAX_PER_ITEM),
});

/** The − and + buttons on the cart page. */
export async function updateCartLine(formData: FormData): Promise<void> {
  const parsed = lineSchema.safeParse({ productId: formData.get("productId"), quantity: formData.get("quantity") });
  if (!parsed.success) return;
  const result = await changeQuantity(await currentCartOwner(), parsed.data.productId, parsed.data.quantity, "web");
  if (result.ok) refresh();
}

export async function removeCartLine(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string" || !z.uuid().safeParse(productId).success) return;
  await removeItem(await currentCartOwner(), productId, "web");
  refresh();
}
