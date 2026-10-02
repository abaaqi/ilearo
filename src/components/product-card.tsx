import Link from "next/link";
import type { Product } from "@/lib/products";
import { TECHNIQUES } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { ProductImage } from "./product-image";
import { StockNote } from "./stock-note";

export function ProductCard({ product, headingLevel = 3 }: { product: Product; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-pit">
        <ProductImage name={product.name} art={product.art} imageUrl={product.imageUrl} />
        {product.stock === 0 ? (
          <span className="absolute left-3 top-3 bg-resist px-2.5 py-1 text-sm font-semibold text-pit">Sold out</span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <Heading className="font-semibold leading-snug">
          <Link
            href={`/products/${product.slug}`}
            className="text-pit no-underline after:absolute after:inset-0 group-hover:underline"
          >
            {product.name}
          </Link>
        </Heading>
        <p className="tabular shrink-0 font-semibold">{formatNaira(product.priceKobo)}</p>
      </div>
      <p className="text-sm text-faded">
        {TECHNIQUES[product.technique].label}, {TECHNIQUES[product.technique].short.toLowerCase()}
        {product.stock > 0 ? <StockNote stock={product.stock} className="ml-2" /> : null}
      </p>
    </article>
  );
}
