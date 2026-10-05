import { apiJson, apiProduct, apiRoute } from "@/lib/api";
import { isCategory, isTechnique } from "@/lib/catalog";
import { listProducts } from "@/lib/products";

/** GET /api/v1/products?category=cloth&technique=oniko: the products for sale, in shop order. */
export const GET = apiRoute(async (request) => {
  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const technique = params.get("technique");
  const products = await listProducts({
    category: isCategory(category) ? category : undefined,
    technique: isTechnique(technique) ? technique : undefined,
  });
  return apiJson({ products: products.map(apiProduct) });
});
