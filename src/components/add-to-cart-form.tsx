"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { addToCart, type AddToCartState } from "@/app/cart/actions";
import { MAX_PER_ITEM } from "@/lib/catalog";

const INITIAL: AddToCartState = { status: "idle" };

export function AddToCartForm({ productId, stock }: { productId: string; stock: number }) {
  const [state, formAction, pending] = useActionState(addToCart, INITIAL);
  const quantityId = useId();
  const max = Math.min(stock, MAX_PER_ITEM);

  if (stock <= 0) {
    return (
      <p className="border-l-4 border-pit bg-cloth px-4 py-3 font-semibold">
        Sold out. We dye in small batches, so check back soon.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={quantityId} className="label">
            Quantity
          </label>
          <select id={quantityId} name="quantity" defaultValue="1" className="field w-24">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary min-w-48 flex-1 sm:flex-none" disabled={pending}>
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>
      <div role="status" aria-live="polite" className="min-h-6">
        {state.status === "added" ? (
          <p key={state.at} className="font-semibold">
            {state.message}{" "}
            <Link href="/cart" className="link">
              View cart
            </Link>
          </p>
        ) : null}
        {state.status === "error" ? (
          <p key={state.at} className="font-semibold text-alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
