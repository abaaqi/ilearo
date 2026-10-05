import { ApiError, apiCaller, apiJson, apiOrder, apiRoute, requireUser } from "@/lib/api";
import { getOrderForUser } from "@/lib/orders";

/** GET /api/v1/orders/:reference: one of the shopper's own orders. */
export const GET = apiRoute<{ params: Promise<{ reference: string }> }>(async (request, { params }) => {
  const user = requireUser(await apiCaller(request, { cookies: true }));
  const order = await getOrderForUser((await params).reference, user.id);
  if (!order) throw new ApiError(404, "We couldn't find that order on your account.");
  return apiJson({ order: apiOrder(order) });
});
