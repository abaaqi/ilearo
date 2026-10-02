import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { ProductImage } from "@/components/product-image";
import { requireUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { bankDetails } from "@/lib/env";
import { lastDeliveryDetails } from "@/lib/orders";
import { signOut } from "../account/actions";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
        <h1 className="font-stencil text-6xl">Checkout</h1>
        <p className="mt-4 text-lg">Your cart is empty, so there&apos;s nothing to check out yet.</p>
        <p className="mt-6">
          <Link href="/shop" className="btn btn-primary">
            Browse the shop
          </Link>
        </p>
      </div>
    );
  }

  if (cart.hasProblems) {
    return (
      <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
        <h1 className="font-stencil text-6xl">Checkout</h1>
        <p className="mt-4 max-w-[36rem] text-lg">
          Some pieces in your cart have sold out or run low since you added them. Update your cart, then come back to
          check out.
        </p>
        <p className="mt-6">
          <Link href="/cart" className="btn btn-primary">
            Review your cart
          </Link>
        </p>
      </div>
    );
  }

  const previous = await lastDeliveryDetails(user.id);

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">Checkout</h1>

      <section aria-labelledby="contact-title" className="mt-8 max-w-[44rem]">
        <h2 id="contact-title" className="heading-flare text-2xl">
          Contact
        </h2>
        <p className="mt-2">
          Signed in as <strong>{user.name ?? user.email}</strong>
          {user.name ? <> ({user.email})</> : null}. We&apos;ll email your order confirmation there.
        </p>
        <form action={signOut} className="mt-1">
          <button type="submit" className="link text-sm font-semibold">
            Not you? Sign out
          </button>
        </form>
      </section>

      <div className="mt-10">
        <CheckoutForm
          lines={cart.lines.map((line) => ({
            productId: line.productId,
            name: line.name,
            quantity: line.quantity,
            lineTotalKobo: line.lineTotalKobo,
            thumbnail: <ProductImage name={line.name} art={line.art} imageUrl={line.imageUrl} />,
          }))}
          subtotalKobo={cart.subtotalKobo}
          bankTransferAvailable={bankDetails() !== null}
          initialValues={previous ?? { fullName: user.name ?? "" }}
        />
      </div>
    </div>
  );
}
