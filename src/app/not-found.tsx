import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-16 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">Page not found</h1>
      <p className="mt-4 max-w-[34rem] text-lg">
        The link may be mistyped, or the piece may have been taken off the shop. If you followed a link to an order,
        make sure you&apos;re signed in with the account that placed it.
      </p>
      <p className="mt-8 flex flex-wrap gap-4">
        <Link href="/shop" className="btn btn-primary">
          Go to the shop
        </Link>
        <Link href="/account" className="btn btn-outline">
          Your orders
        </Link>
      </p>
    </div>
  );
}
