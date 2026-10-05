import type { Metadata } from "next";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { SubmitButton } from "@/components/submit-button";
import { cartProblemText, getCart, type CartLine } from "@/lib/cart";
import { MAX_PER_ITEM, TECHNIQUES } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { FREE_DELIVERY_FROM_KOBO } from "@/lib/shipping";
import { removeCartLine, updateCartLine } from "./actions";

export const metadata: Metadata = { title: "Your cart" };

function QuantityControl({ line }: { line: CartLine }) {
  const canAdd = line.quantity < Math.min(line.stock, MAX_PER_ITEM) && line.problem !== "unavailable";
  return (
    <form action={updateCartLine} className="flex items-center">
      <input type="hidden" name="productId" value={line.productId} />
      <SubmitButton
        name="quantity"
        value={line.quantity - 1}
        aria-label={`One fewer ${line.name}`}
        className="grid size-11 place-items-center border border-line text-xl leading-none hover:border-pit disabled:opacity-40"
      >
        −
      </SubmitButton>
      <output aria-label={`Quantity of ${line.name}`} className="tabular grid h-11 w-12 place-items-center border-y border-line font-semibold">
        {line.quantity}
      </output>
      <SubmitButton
        name="quantity"
        value={line.quantity + 1}
        aria-label={`One more ${line.name}`}
        disabled={!canAdd}
        className="grid size-11 place-items-center border border-line text-xl leading-none hover:border-pit disabled:opacity-40"
      >
        +
      </SubmitButton>
    </form>
  );
}

export default async function CartPage() {
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
        <h1 className="font-stencil text-6xl">Your cart</h1>
        <p className="mt-4 text-lg">Your cart is empty.</p>
        <p className="mt-6">
          <Link href="/shop" className="btn btn-primary">
            Browse the shop
          </Link>
        </p>
      </div>
    );
  }

  const toFree = FREE_DELIVERY_FROM_KOBO - cart.subtotalKobo;

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">Your cart</h1>

      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="border-t border-wash">
          {cart.lines.map((line) => {
            const problem = cartProblemText(line);
            return (
              <li key={line.productId} className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-3 border-b border-wash py-5 sm:grid-cols-[7rem_1fr_auto]">
                <Link href={`/products/${line.slug}`} tabIndex={-1} aria-hidden="true" className="row-span-2 block aspect-square overflow-hidden bg-pit sm:row-span-1">
                  <ProductImage name={line.name} art={line.art} imageUrl={line.imageUrl} />
                </Link>
                <div>
                  <h2 className="font-semibold leading-snug">
                    <Link href={`/products/${line.slug}`} className="text-pit no-underline hover:underline">
                      {line.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-faded">
                    {TECHNIQUES[line.technique].label}, {formatNaira(line.priceKobo)} each
                  </p>
                  {problem ? <p className="mt-1 text-sm font-semibold text-alert">{problem}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <QuantityControl line={line} />
                    <form action={removeCartLine}>
                      <input type="hidden" name="productId" value={line.productId} />
                      <SubmitButton className="link min-h-11 text-sm font-semibold" aria-label={`Remove ${line.name}`}>
                        Remove
                      </SubmitButton>
                    </form>
                  </div>
                </div>
                <p className="tabular col-start-2 font-semibold sm:col-start-3 sm:text-right">{formatNaira(line.lineTotalKobo)}</p>
              </li>
            );
          })}
        </ul>

        <aside aria-labelledby="summary-title" className="self-start border border-wash bg-cloth p-6 lg:sticky lg:top-6">
          <h2 id="summary-title" className="heading-flare text-xl">
            Summary
          </h2>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between gap-4">
              <dt>
                Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="tabular font-semibold">{formatNaira(cart.subtotalKobo)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-faded">
              <dt>Delivery</dt>
              <dd>Worked out at checkout</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm">
            {toFree > 0
              ? `Add ${formatNaira(toFree)} more for free delivery.`
              : "Your order qualifies for free delivery."}
          </p>
          {cart.hasProblems ? (
            <p className="mt-4 text-sm font-semibold text-alert">Fix the items marked above to check out.</p>
          ) : null}
          <div className="mt-5">
            {cart.hasProblems ? (
              <span aria-disabled="true" className="btn btn-primary w-full">
                Check out
              </span>
            ) : (
              <Link href="/checkout" className="btn btn-primary w-full">
                Check out
              </Link>
            )}
          </div>
          <p className="mt-4 text-center text-sm">
            <Link href="/shop" className="link">
              Keep shopping
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
