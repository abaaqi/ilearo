import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { requireUser } from "@/lib/auth/session";
import { bankDetails } from "@/lib/env";
import { getOrderForUser, ORDER_STATUS_LABELS, paymentSummary } from "@/lib/orders";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatNigerianPhone } from "@/lib/phone";
import { DELIVERY_ZONES, isNigerianState, zoneForState } from "@/lib/shipping";
import { PAYMENT_METHOD_LABELS } from "@/lib/checkout-schema";

type Params = Promise<{ reference: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `Order ${(await params).reference}` };
}

export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { reference } = await params;
  const user = await requireUser(`/orders/${reference}`);
  const order = await getOrderForUser(reference, user.id);
  if (!order) notFound();

  const justPlaced = (await searchParams).placed === "1";
  const bank = bankDetails();
  const firstName = (user.name ?? order.customerName).trim().split(/\s+/)[0];
  const days = isNigerianState(order.state) ? DELIVERY_ZONES[zoneForState(order.state)].days : null;
  const awaitingTransfer = order.paymentMethod === "bank_transfer" && order.paymentStatus === "unpaid";

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
      {justPlaced ? (
        <>
          <h1 className="font-stencil text-[clamp(3rem,7vw,4.75rem)]">Thank you, {firstName}</h1>
          <p className="mt-4 max-w-[40rem] text-lg">
            Order <strong className="tabular">{order.reference}</strong> is placed. A confirmation is on its way to{" "}
            <strong>{order.email}</strong>.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-stencil text-6xl">Order {order.reference}</h1>
          <p className="mt-3 text-lg">Placed {formatDateTime(order.createdAt)}</p>
        </>
      )}

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="pay-title" className="border-l-4 border-pit bg-cloth px-6 py-5">
            <h2 id="pay-title" className="heading-flare text-xl">
              {awaitingTransfer ? "How to pay" : "Payment"}
            </h2>
            {awaitingTransfer && bank ? (
              <>
                <p className="mt-2">
                  Transfer <strong className="tabular">{formatNaira(order.totalKobo)}</strong> to:
                </p>
                <dl className="mt-3 grid max-w-md grid-cols-[9rem_1fr] gap-y-1.5">
                  <dt className="text-faded">Bank</dt>
                  <dd className="font-semibold">{bank.bankName}</dd>
                  <dt className="text-faded">Account name</dt>
                  <dd className="font-semibold">{bank.accountName}</dd>
                  <dt className="text-faded">Account number</dt>
                  <dd className="tabular font-semibold">{bank.accountNumber}</dd>
                  <dt className="text-faded">Narration</dt>
                  <dd className="tabular font-semibold">{order.reference}</dd>
                </dl>
                <p className="mt-3 text-sm">We&apos;ll start packing as soon as your transfer arrives.</p>
              </>
            ) : awaitingTransfer ? (
              <p className="mt-2">
                We&apos;ll email you our account details for a transfer of{" "}
                <strong className="tabular">{formatNaira(order.totalKobo)}</strong>.
              </p>
            ) : order.paymentStatus === "unpaid" ? (
              <p className="mt-2">
                Pay <strong className="tabular">{formatNaira(order.totalKobo)}</strong> when your order arrives, in cash or by
                transfer to the rider.
              </p>
            ) : (
              <p className="mt-2">{paymentSummary(order)}.</p>
            )}
          </section>

          <section aria-labelledby="items-title">
            <h2 id="items-title" className="heading-flare text-xl">
              What you ordered
            </h2>
            <ul className="mt-3 border-t border-wash">
              {order.items.map((item) => (
                <li key={item.productSlug} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 border-b border-wash py-4">
                  <span className="block aspect-square overflow-hidden bg-pit">
                    <ProductImage name={item.productName} art={item.art} imageUrl={item.imageUrl} />
                  </span>
                  <span>
                    {item.stillListed ? (
                      <Link href={`/products/${item.productSlug}`} className="font-semibold text-pit no-underline hover:underline">
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{item.productName}</span>
                    )}
                    <span className="block text-sm text-faded">
                      {item.quantity} × {formatNaira(item.unitPriceKobo)}
                    </span>
                  </span>
                  <span className="tabular font-semibold">{formatNaira(item.lineTotalKobo)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 ml-auto max-w-xs space-y-1.5">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="tabular">{formatNaira(order.subtotalKobo)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Delivery</dt>
                <dd className="tabular">{order.deliveryKobo === 0 ? "Free" : formatNaira(order.deliveryKobo)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-wash pt-2 text-lg font-bold">
                <dt>Total</dt>
                <dd className="tabular">{formatNaira(order.totalKobo)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="flex flex-col gap-8 self-start border border-wash bg-cloth p-6">
          <section aria-labelledby="status-title">
            <h2 id="status-title" className="heading-flare text-xl">
              Status
            </h2>
            <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1.5">
              <dt className="text-faded">Order</dt>
              <dd className="font-semibold">{ORDER_STATUS_LABELS[order.status]}</dd>
              <dt className="text-faded">Payment</dt>
              <dd className="font-semibold">{paymentSummary(order)}</dd>
              <dt className="text-faded">Method</dt>
              <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
              <dt className="text-faded">Placed</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </dl>
          </section>

          <section aria-labelledby="delivery-title">
            <h2 id="delivery-title" className="heading-flare text-xl">
              Delivery to
            </h2>
            <address className="mt-3 not-italic">
              {order.customerName}
              <br />
              {order.addressLine1}
              {order.addressLine2 ? (
                <>
                  <br />
                  {order.addressLine2}
                </>
              ) : null}
              <br />
              {order.city}, {order.state}
              <br />
              <span className="tabular">{formatNigerianPhone(order.phone)}</span>
            </address>
            {order.deliveryNotes ? <p className="mt-3 text-sm text-faded">Notes: {order.deliveryNotes}</p> : null}
            {days ? <p className="mt-3 text-sm">Usually arrives in {days}. We&apos;ll call before we set out.</p> : null}
          </section>
        </aside>
      </div>

      <p className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
        <Link href="/shop" className="btn btn-primary">
          Keep shopping
        </Link>
        <Link href="/account" className="btn btn-outline">
          All your orders
        </Link>
      </p>
    </div>
  );
}
