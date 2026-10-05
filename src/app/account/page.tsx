import type { Metadata } from "next";
import Link from "next/link";
import { appSessionCount, requireUser } from "@/lib/auth/session";
import { listOrdersForUser, ORDER_STATUS_LABELS } from "@/lib/orders";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const [orders, phones] = await Promise.all([listOrdersForUser(user.id), appSessionCount(user.id)]);

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">Your account</h1>

      <section aria-labelledby="profile-title" className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-y border-wash py-5">
        <h2 id="profile-title" className="sr-only">
          Profile
        </h2>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" width={56} height={56} referrerPolicy="no-referrer" className="size-14 rounded-full" />
        ) : (
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-pit text-xl text-starch">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          {user.name ? <p className="text-lg font-semibold">{user.name}</p> : null}
          <p>{user.email}</p>
          <p className="text-sm text-faded">Signed in with Google</p>
          {phones > 0 ? (
            <p className="text-sm text-faded">
              Also signed in on the Ile Aro app on {phones === 1 ? "1 phone" : `${phones} phones`}, sharing this cart.
            </p>
          ) : null}
        </div>
        <form action={signOut} className="ml-auto">
          <button type="submit" className="btn btn-outline">
            Sign out
          </button>
        </form>
      </section>

      <section aria-labelledby="orders-title" className="mt-12">
        <h2 id="orders-title" className="font-stencil text-4xl">
          Orders
        </h2>
        {orders.length === 0 ? (
          <div className="mt-4">
            <p className="text-lg">You haven&apos;t placed an order yet.</p>
            <p className="mt-5">
              <Link href="/shop" className="btn btn-primary">
                Browse the shop
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-5 border-t border-wash">
            {orders.map((order) => (
              <li
                key={order.reference}
                className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-wash py-4 sm:grid-cols-[8rem_1fr_7rem_9rem_8rem] sm:items-baseline"
              >
                <Link href={`/orders/${order.reference}`} className="link tabular font-semibold">
                  {order.reference}
                </Link>
                <span className="text-right sm:text-left">{formatDate(order.createdAt)}</span>
                <span className="text-sm text-faded sm:text-base sm:text-pit">
                  {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                </span>
                <span className="text-right text-sm sm:text-left sm:text-base">{ORDER_STATUS_LABELS[order.status]}</span>
                <span className="tabular col-span-2 font-semibold sm:col-span-1 sm:text-right">{formatNaira(order.totalKobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
