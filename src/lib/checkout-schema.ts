import { z } from "zod";
import { normalizeNigerianPhone } from "./phone";
import { NIGERIAN_STATES } from "./shipping";

export const PAYMENT_METHODS = ["pay_on_delivery", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pay_on_delivery: "Pay on delivery",
  bank_transfer: "Bank transfer",
};

/** How each way to pay is explained at checkout, on the website and in the app. */
export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  pay_on_delivery: "Pay the rider in cash or by transfer when your order arrives.",
  bank_transfer: "Pay before we send it. You'll get our account details as soon as you place the order.",
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the name of the person receiving the order.")
    .max(100, "Keep the name under 100 characters."),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeNigerianPhone(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a Nigerian mobile number, like 0803 123 4567.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  address1: z
    .string()
    .trim()
    .min(5, "Enter a street address, like 12 Adeola Odeku Street.")
    .max(200, "Keep the address under 200 characters."),
  address2: optionalText(200, "Keep this line under 200 characters."),
  city: z
    .string()
    .trim()
    .min(2, "Enter the town or city.")
    .max(80, "Keep the town or city under 80 characters."),
  state: z.enum(NIGERIAN_STATES, { error: "Choose the state for delivery." }),
  notes: optionalText(500, "Keep delivery notes under 500 characters."),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Choose how you'd like to pay." }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const CHECKOUT_FIELDS = [
  "fullName",
  "phone",
  "address1",
  "address2",
  "city",
  "state",
  "notes",
  "paymentMethod",
] as const;

export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];
export type CheckoutValues = Partial<Record<CheckoutField, string>>;

/**
 * Pulls only the expected fields out of a submitted form. Anything missing
 * becomes "" so the schema answers with its own, readable messages.
 */
export function readCheckoutForm(formData: FormData): Record<CheckoutField, string> {
  const values = {} as Record<CheckoutField, string>;
  for (const field of CHECKOUT_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}
