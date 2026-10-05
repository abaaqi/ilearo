import "server-only";
import { after } from "next/server";
import { z } from "zod";
import type { SessionUser } from "./auth/session";
import type { CartClient } from "./cart";
import { bankDetails } from "./env";
import { checkoutSchema, type CheckoutField } from "./checkout-schema";
import { placeOrder, recentOrderReference, type StockProblem } from "./orders";
import { sendOrderConfirmation } from "./email/order-emails";

/** Checking out, shared by the website's checkout form and the app's API. */

export type CheckoutOutcome =
  | { ok: true; orderId: string; reference: string }
  | { ok: false; reason: "invalid"; message: string; fieldErrors: Partial<Record<CheckoutField, string>> }
  | { ok: false; reason: "stock"; message: string }
  /** Nothing to buy, most often because a first tap on "Place order" already went through. */
  | { ok: false; reason: "empty"; recentReference: string | null }
  | { ok: false; reason: "failed"; message: string };

const FIX_DETAILS = "Some details need fixing before we can place your order.";

export function describeStockProblems(problems: StockProblem[]): string {
  const lines = problems.map((p) => {
    if (p.problem === "short") return `${p.name}: only ${p.available} left, and your cart has ${p.requested}.`;
    if (p.problem === "sold-out") return `${p.name} has sold out.`;
    return `${p.name} is no longer for sale.`;
  });
  return `${lines.join(" ")} Update your cart, then come back to check out.`;
}

export async function checkout(
  user: SessionUser,
  values: Record<CheckoutField, string>,
  client: CartClient,
): Promise<CheckoutOutcome> {
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CheckoutField, string>> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      const first = (messages as string[] | undefined)?.[0];
      if (first) fieldErrors[field as CheckoutField] = first;
    }
    return { ok: false, reason: "invalid", message: FIX_DETAILS, fieldErrors };
  }

  if (parsed.data.paymentMethod === "bank_transfer" && !bankDetails()) {
    return {
      ok: false,
      reason: "invalid",
      message: FIX_DETAILS,
      fieldErrors: { paymentMethod: "Bank transfer isn't available at the moment. Choose pay on delivery." },
    };
  }

  let result;
  try {
    result = await placeOrder(user, parsed.data, client);
  } catch (error) {
    console.error("[checkout] Could not place the order:", error);
    return {
      ok: false,
      reason: "failed",
      message: "We couldn't place your order just now. Your cart hasn't changed, so please try again in a moment.",
    };
  }

  if (!result.ok) {
    if (result.reason === "empty") return { ok: false, reason: "empty", recentReference: await recentOrderReference(user.id) };
    return { ok: false, reason: "stock", message: describeStockProblems(result.problems) };
  }

  // Email after the response is sent, so a slow Mailgun never holds up checkout.
  const { orderId } = result;
  after(() => sendOrderConfirmation(orderId));
  return { ok: true, orderId, reference: result.reference };
}
