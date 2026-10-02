"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { placeOrderAction, type CheckoutState } from "@/app/checkout/actions";
import type { CheckoutField, PaymentMethod } from "@/lib/checkout-schema";
import { formatNaira } from "@/lib/money";
import { DELIVERY_ZONES, NIGERIAN_STATES, deliveryQuote, isNigerianState } from "@/lib/shipping";

export type SummaryLine = {
  productId: string;
  name: string;
  quantity: number;
  lineTotalKobo: number;
  /** Rendered on the server and passed in, so the artwork is never re-drawn in the browser. */
  thumbnail: ReactNode;
};

type Props = {
  lines: SummaryLine[];
  subtotalKobo: number;
  bankTransferAvailable: boolean;
  initialValues: Partial<Record<CheckoutField, string>>;
};

const INITIAL: CheckoutState = { status: "idle" };

const FIELD_LABELS: Record<CheckoutField, string> = {
  fullName: "Full name",
  phone: "Phone number",
  address1: "Street address",
  address2: "Apartment, estate or landmark",
  city: "Town or city",
  state: "State",
  notes: "Delivery notes",
  paymentMethod: "Payment",
};

export function CheckoutForm(props: Props) {
  const [state, formAction, pending] = useActionState(placeOrderAction, INITIAL);
  const failed = state.status === "error" ? state : null;
  // A new key after each failed attempt remounts the fields with what was submitted,
  // because React resets uncontrolled inputs once a form action finishes.
  return (
    <CheckoutFields
      key={failed?.submissionId ?? 0}
      {...props}
      formAction={formAction}
      pending={pending}
      failed={failed}
      values={failed?.values ?? props.initialValues}
    />
  );
}

function CheckoutFields({
  lines,
  subtotalKobo,
  bankTransferAvailable,
  values,
  failed,
  formAction,
  pending,
}: Props & {
  values: Partial<Record<CheckoutField, string>>;
  failed: Extract<CheckoutState, { status: "error" }> | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [deliveryState, setDeliveryState] = useState(values.state ?? "");
  const summaryRef = useRef<HTMLDivElement>(null);
  const errors = failed?.fieldErrors ?? {};
  const quote = isNigerianState(deliveryState) ? deliveryQuote(deliveryState, subtotalKobo) : null;
  const totalKobo = subtotalKobo + (quote?.feeKobo ?? 0);
  const defaultPayment: PaymentMethod =
    values.paymentMethod === "bank_transfer" && bankTransferAvailable ? "bank_transfer" : "pay_on_delivery";

  useEffect(() => {
    if (failed) summaryRef.current?.focus();
  }, [failed]);

  const describedBy = (field: CheckoutField, hint = false) =>
    [hint ? `${field}-hint` : null, errors[field] ? `${field}-error` : null].filter(Boolean).join(" ") || undefined;

  const fieldError = (field: CheckoutField) =>
    errors[field] ? (
      <span id={`${field}-error`} className="error-text">
        {errors[field]}
      </span>
    ) : null;

  const text = (
    field: CheckoutField,
    options: { autoComplete?: string; hint?: string; type?: string; inputMode?: "tel" | "text"; optional?: boolean; maxLength: number },
  ) => (
    <div>
      <label htmlFor={field} className="label">
        {FIELD_LABELS[field]}
        {options.optional ? <span className="font-normal text-faded"> (optional)</span> : null}
      </label>
      {options.hint ? (
        <span id={`${field}-hint`} className="hint">
          {options.hint}
        </span>
      ) : null}
      {fieldError(field)}
      <input
        id={field}
        name={field}
        type={options.type ?? "text"}
        inputMode={options.inputMode}
        autoComplete={options.autoComplete}
        defaultValue={values[field] ?? ""}
        maxLength={options.maxLength}
        required={!options.optional}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describedBy(field, Boolean(options.hint))}
        className="field"
      />
    </div>
  );

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form action={formAction} noValidate className="flex flex-col gap-10">
        {failed ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="border-l-4 border-alert bg-cloth px-5 py-4 outline-none focus-visible:outline-3 focus-visible:outline-indigo"
          >
            <h2 className="font-semibold text-alert">{failed.message}</h2>
            {Object.keys(errors).length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {(Object.keys(errors) as CheckoutField[]).map((field) => (
                  <li key={field}>
                    <a href={`#${field === "paymentMethod" ? "payment-pay_on_delivery" : field}`} className="link">
                      {errors[field]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {failed.cartLink ? (
              <p className="mt-2">
                <Link href="/cart" className="link font-semibold">
                  Go to your cart
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-5">
          <legend className="heading-flare mb-4 text-2xl">Delivery</legend>
          {text("fullName", { autoComplete: "name", maxLength: 100, hint: "The person we hand the parcel to." })}
          {text("phone", {
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            maxLength: 20,
            hint: "We call this number before we deliver.",
          })}
          {text("address1", { autoComplete: "address-line1", maxLength: 200 })}
          {text("address2", { autoComplete: "address-line2", maxLength: 200, optional: true })}
          <div className="grid gap-5 sm:grid-cols-2">
            {text("city", { autoComplete: "address-level2", maxLength: 80 })}
            <div>
              <label htmlFor="state" className="label">
                {FIELD_LABELS.state}
              </label>
              {fieldError("state")}
              <select
                id="state"
                name="state"
                autoComplete="address-level1"
                required
                defaultValue={values.state ?? ""}
                onChange={(event) => setDeliveryState(event.target.value)}
                aria-invalid={errors.state ? true : undefined}
                aria-describedby={[errors.state ? "state-error" : null, "delivery-quote"].filter(Boolean).join(" ")}
                className="field"
              >
                <option value="" disabled>
                  Choose a state
                </option>
                {NIGERIAN_STATES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p id="delivery-quote" aria-live="polite" className="-mt-2 text-sm text-faded">
            {quote
              ? quote.free
                ? `Free delivery to ${deliveryState}, usually ${quote.days}.`
                : `Delivery to ${deliveryState}: ${formatNaira(quote.feeKobo)}, usually ${quote.days}.`
              : `Delivery costs ${formatNaira(DELIVERY_ZONES.lagos.feeKobo)} to ${formatNaira(DELIVERY_ZONES["rest-of-nigeria"].feeKobo)} depending on the state.`}
          </p>
          <div>
            <label htmlFor="notes" className="label">
              {FIELD_LABELS.notes} <span className="font-normal text-faded">(optional)</span>
            </label>
            <span id="notes-hint" className="hint">
              Gate codes, a landmark, or the best time to reach you.
            </span>
            {fieldError("notes")}
            <textarea
              id="notes"
              name="notes"
              maxLength={500}
              defaultValue={values.notes ?? ""}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={describedBy("notes", true)}
              className="field"
            />
          </div>
        </fieldset>

        <fieldset aria-describedby={errors.paymentMethod ? "paymentMethod-error" : undefined}>
          <legend className="heading-flare mb-4 text-2xl">Payment</legend>
          {fieldError("paymentMethod")}
          <div className="grid gap-3">
            <PaymentOption
              value="pay_on_delivery"
              title="Pay on delivery"
              description="Pay the rider in cash or by transfer when your order arrives."
              defaultChecked={defaultPayment === "pay_on_delivery"}
            />
            {bankTransferAvailable ? (
              <PaymentOption
                value="bank_transfer"
                title="Bank transfer"
                description="Pay before we send it. You'll get our account details as soon as you place the order."
                defaultChecked={defaultPayment === "bank_transfer"}
              />
            ) : null}
          </div>
        </fieldset>

        <div>
          <button type="submit" className="btn btn-primary w-full text-lg sm:w-auto sm:min-w-72" disabled={pending}>
            {pending ? "Placing your order…" : `Place order for ${formatNaira(totalKobo)}`}
          </button>
          {!quote ? <p className="mt-2 text-sm text-faded">The total includes delivery once you choose a state.</p> : null}
        </div>
      </form>

      <aside aria-labelledby="order-summary-title" className="self-start border border-wash bg-cloth p-6 lg:sticky lg:top-6">
        <h2 id="order-summary-title" className="heading-flare text-xl">
          Your order
        </h2>
        <ul className="mt-4 divide-y divide-wash">
          {lines.map((line) => (
            <li key={line.productId} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-3">
              <span className="block aspect-square overflow-hidden bg-pit">{line.thumbnail}</span>
              <span className="text-sm leading-snug">
                {line.name}
                <span className="block text-faded">Quantity {line.quantity}</span>
              </span>
              <span className="tabular text-sm font-semibold">{formatNaira(line.lineTotalKobo)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 border-t border-wash pt-4">
          <div className="flex justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="tabular">{formatNaira(subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delivery</dt>
            <dd className="tabular">{quote ? (quote.free ? "Free" : formatNaira(quote.feeKobo)) : "Choose a state"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-wash pt-3 text-lg font-bold">
            <dt>Total</dt>
            <dd className="tabular">{formatNaira(totalKobo)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          <Link href="/cart" className="link">
            Change your cart
          </Link>
        </p>
      </aside>
    </div>
  );
}

function PaymentOption({
  value,
  title,
  description,
  defaultChecked,
}: {
  value: PaymentMethod;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  const id = `payment-${value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer gap-3 border-2 border-wash bg-cloth p-4 has-[:checked]:border-pit has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo"
    >
      <input
        id={id}
        type="radio"
        name="paymentMethod"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 size-5 shrink-0 accent-pit focus-visible:outline-none"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-faded">{description}</span>
      </span>
    </label>
  );
}
