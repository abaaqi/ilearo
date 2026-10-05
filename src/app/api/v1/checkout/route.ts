import { apiCaller, apiCart, apiJson, apiRoute, apiUser, requireUser } from "@/lib/api";
import { loadCart } from "@/lib/cart";
import { PAYMENT_METHOD_DESCRIPTIONS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/checkout-schema";
import { bankDetails } from "@/lib/env";
import { lastDeliveryDetails } from "@/lib/orders";

/**
 * GET /api/v1/checkout: what the checkout screen needs. Who's ordering, the
 * delivery details from their last order (on the website or in the app), the
 * ways to pay, and the cart. Place the order with POST /api/v1/orders.
 */
export const GET = apiRoute(async (request) => {
  const user = requireUser(await apiCaller(request));
  const methods: PaymentMethod[] = bankDetails() ? ["pay_on_delivery", "bank_transfer"] : ["pay_on_delivery"];
  const [previous, cart] = await Promise.all([lastDeliveryDetails(user.id), loadCart({ userId: user.id })]);
  return apiJson({
    contact: apiUser(user),
    defaults: previous ?? { fullName: user.name ?? "" },
    paymentMethods: methods.map((value) => ({
      value,
      title: PAYMENT_METHOD_LABELS[value],
      description: PAYMENT_METHOD_DESCRIPTIONS[value],
    })),
    cart: apiCart(cart),
  });
});
