import { apiJson, apiRoute, apiShopInfo } from "@/lib/api";

/** GET /api/v1/shop: categories, techniques, delivery zones and payment options. */
export const GET = apiRoute(async () => apiJson({ shop: apiShopInfo() }));
