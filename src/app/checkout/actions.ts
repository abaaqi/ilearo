"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { bankDetails } from "@/lib/env";
import { checkoutSchema, readCheckoutForm, type CheckoutField } from "@/lib/checkout-schema";
import { placeOrder, recentOrderReference, type PlaceOrderResult, type StockProblem } from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/email/order-emails";

export type CheckoutState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<CheckoutField, string>>;
      values: Record<CheckoutField, string>;
      /** Changes on every failed submission so the form re-renders with what was sent. */
      submissionId: number;
      /** Show a link back to the cart (stock changed while they were checking out). */
      cartLink?: boolean;
    };

function describeProblems(problems: StockProblem[]): string {
  const lines = problems.map((p) => {
    if (p.problem === "short") return `${p.name}: only ${p.available} left, and your cart has ${p.requested}.`;
    if (p.problem === "sold-out") return `${p.name} has sold out.`;
    return `${p.name} is no longer for sale.`;
  });
  return `${lines.join(" ")} Update your cart, then come back to check out.`;
}

export async function placeOrderAction(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?returnTo=%2Fcheckout");

  const values = readCheckoutForm(formData);
  const submissionId = Date.now();
  const fail = (message: string, fieldErrors: Partial<Record<CheckoutField, string>> = {}, cartLink = false): CheckoutState => ({
    status: "error",
    message,
    fieldErrors,
    values,
    submissionId,
    cartLink,
  });

  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CheckoutField, string>> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      const first = (messages as string[] | undefined)?.[0];
      if (first) fieldErrors[field as CheckoutField] = first;
    }
    return fail("Some details need fixing before we can place your order.", fieldErrors);
  }

  if (parsed.data.paymentMethod === "bank_transfer" && !bankDetails()) {
    return fail("Some details need fixing before we can place your order.", {
      paymentMethod: "Bank transfer isn't available at the moment. Choose pay on delivery.",
    });
  }

  let result: PlaceOrderResult;
  try {
    result = await placeOrder(user, parsed.data);
  } catch (error) {
    console.error("[checkout] Could not place the order:", error);
    return fail("We couldn't place your order just now. Your cart hasn't changed, so please try again in a moment.");
  }

  if (!result.ok) {
    if (result.reason === "empty") {
      // Most often a second click on "Place order": take them to the order the first click made.
      const recent = await recentOrderReference(user.id);
      redirect(recent ? `/orders/${recent}?placed=1` : "/cart");
    }
    return fail(describeProblems(result.problems), {}, true);
  }

  // Email after the response is sent, so a slow Mailgun never holds up checkout.
  const { orderId, reference } = result;
  after(() => sendOrderConfirmation(orderId));
  // The header's cart count lives in the shared layout; refresh it along with the page.
  revalidatePath("/", "layout");
  redirect(`/orders/${reference}?placed=1`);
}
