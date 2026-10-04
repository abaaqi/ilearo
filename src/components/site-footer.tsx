import Link from "next/link";
import { bankDetails, supportEmail } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { DELIVERY_ZONES, FREE_DELIVERY_FROM_KOBO } from "@/lib/shipping";
import { SHOP } from "@/lib/shop";

export function SiteFooter() {
  const email = supportEmail();
  const bankTransfer = bankDetails() !== null;

  return (
    <footer className="on-indigo mt-24 bg-pit text-starch">
      <div className="mx-auto grid max-w-[76rem] gap-x-12 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
        <div>
          <p className="font-stencil text-4xl tracking-[0.04em]">{SHOP.name}</p>
          <p className="mt-3 max-w-sm text-starch/85">{SHOP.description}</p>
        </div>

        <div>
          <h2 className="heading-flare text-lg">Delivery</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.values(DELIVERY_ZONES).map((zone) => (
              <div key={zone.label} className="flex justify-between gap-4 border-b border-starch/15 pb-2">
                <dt>
                  {zone.label}
                  <span className="block text-starch/70">{zone.days}</span>
                </dt>
                <dd className="tabular">{formatNaira(zone.feeKobo)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-starch/85">Free on orders of {formatNaira(FREE_DELIVERY_FROM_KOBO)} or more.</p>
        </div>

        <div>
          <h2 className="heading-flare text-lg">Paying and help</h2>
          <p className="mt-3 text-sm text-starch/85">
            Pay on delivery{bankTransfer ? " or by bank transfer" : ""}. Every order is confirmed by email.
          </p>
          {email ? (
            <p className="mt-3 text-sm text-starch/85">
              Questions? Write to{" "}
              <a href={`mailto:${email}`} className="text-starch underline">
                {email}
              </a>
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            <Link href="/account" className="text-starch underline">
              Your orders
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-starch/15">
        <p className="mx-auto max-w-[76rem] px-4 py-5 text-sm text-starch/70 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {SHOP.name}
        </p>
      </div>
    </footer>
  );
}
