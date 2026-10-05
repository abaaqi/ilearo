"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { checkout } from "@/lib/checkout";
import { readCheckoutForm, type CheckoutField } from "@/lib/checkout-schema";

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

export async function placeOrderAction(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?returnTo=%2Fcheckout");

  const values = readCheckoutForm(formData);
  const outcome = await checkout(user, values, "web");

  if (outcome.ok) {
    // The header's cart count lives in the shared layout; refresh it along with the page.
    revalidatePath("/", "layout");
    redirect(`/orders/${outcome.reference}?placed=1`);
  }

  if (outcome.reason === "empty") {
    // Most often a second click on "Place order": take them to the order the first click made.
    redirect(outcome.recentReference ? `/orders/${outcome.recentReference}?placed=1` : "/cart");
  }

  return {
    status: "error",
    message: outcome.message,
    fieldErrors: outcome.reason === "invalid" ? outcome.fieldErrors : {},
    values,
    submissionId: Date.now(),
    cartLink: outcome.reason === "stock",
  };
}
