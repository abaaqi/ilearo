"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCart, getOrCreateCartId, quantityInCart, setLineQuantity } from "@/lib/cart";
import { getProductById } from "@/lib/products";
import { MAX_PER_ITEM } from "@/lib/catalog";

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

  const product = await getProductById(parsed.data.productId);
  if (!product) return { status: "error", message: "This piece is no longer for sale.", at };
  if (product.stock <= 0) return { status: "error", message: "This piece has just sold out.", at };

  const cartId = await getOrCreateCartId();
  const current = await quantityInCart(cartId, product.id);
  const limit = Math.min(product.stock, MAX_PER_ITEM);
  if (current >= limit) {
    const message =
      limit === product.stock
        ? `You already have all ${product.stock} we have in your cart.`
        : `You can have up to ${MAX_PER_ITEM} of one piece in your cart.`;
    return { status: "error", message, at };
  }

  const next = Math.min(current + parsed.data.quantity, limit);
  await setLineQuantity(cartId, product.id, next);
  refresh();

  const added = next - current;
  const message =
    added < parsed.data.quantity
      ? `Added ${added}, which is all we have. You have ${next} in your cart.`
      : `Added to your cart. You have ${next}.`;
  return { status: "added", message, at };
}

const lineSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(0).max(MAX_PER_ITEM),
});

/** The − and + buttons on the cart page. */
export async function updateCartLine(formData: FormData): Promise<void> {
  const parsed = lineSchema.safeParse({ productId: formData.get("productId"), quantity: formData.get("quantity") });
  if (!parsed.success) return;
  const cart = await getCart();
  const line = cart.lines.find((l) => l.productId === parsed.data.productId);
  if (!cart.id || !line) return;
  // Allow going down freely; only allow going up while stock lasts.
  if (parsed.data.quantity > line.quantity && parsed.data.quantity > line.stock) return;
  await setLineQuantity(cart.id, line.productId, parsed.data.quantity);
  refresh();
}

export async function removeCartLine(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (!z.uuid().safeParse(productId).success) return;
  const cart = await getCart();
  if (!cart.id || !cart.lines.some((l) => l.productId === productId)) return;
  await setLineQuantity(cart.id, productId as string, 0);
  refresh();
}
