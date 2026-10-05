import { ApiError, apiJson, apiProductDetail, apiRoute } from "@/lib/api";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";

/** GET /api/v1/products/:slug: one product, with a few others made the same way. */
export const GET = apiRoute<{ params: Promise<{ slug: string }> }>(async (_request, { params }) => {
  const product = await getProductBySlug((await params).slug);
  if (!product) throw new ApiError(404, "This piece is no longer for sale.");
  return apiJson({ product: apiProductDetail(product, await getRelatedProducts(product, 4)) });
});
