import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { StockNote } from "@/components/stock-note";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";
import { CATEGORIES, TECHNIQUES } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { DELIVERY_ZONES, FREE_DELIVERY_FROM_KOBO } from "@/lib/shipping";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.summary } : { title: "Not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);
  const technique = TECHNIQUES[product.technique];
  const category = CATEGORIES[product.category];

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap gap-x-2 text-faded">
          <li>
            <Link href="/shop" className="link">
              Shop
            </Link>
            <span aria-hidden="true" className="ml-2">
              /
            </span>
          </li>
          <li>
            <Link href={`/shop?category=${product.category}`} className="link">
              {category.label}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="md:sticky md:top-6 md:self-start">
          <div className="aspect-square overflow-hidden bg-pit">
            <ProductImage name={product.name} art={product.art} imageUrl={product.imageUrl} described />
          </div>
          <p className="mt-2 text-sm text-faded">
            Every piece is dyed by hand, so yours will differ a little from this one.
          </p>
        </div>

        <div>
          <h1 className="font-stencil text-[clamp(3rem,6vw,4.5rem)]">{product.name}</h1>
          <p className="mt-3 text-lg">{product.summary}</p>
          <p className="tabular mt-5 text-3xl font-bold">{formatNaira(product.priceKobo)}</p>
          <p className="mt-1 min-h-6 text-sm">
            <StockNote stock={product.stock} />
          </p>

          <div className="mt-5">
            <AddToCartForm productId={product.id} stock={product.stock} />
          </div>

          <hr className="stitch-rule my-8" />

          <h2 className="heading-flare text-xl">About this piece</h2>
          <p className="mt-2 max-w-[36rem]">{product.description}</p>

          {product.details.length > 0 ? (
            <dl className="mt-6 max-w-[36rem] border-t border-wash">
              {product.details.map(([term, value]) => (
                <div key={term} className="grid grid-cols-[8rem_1fr] gap-4 border-b border-wash py-2.5">
                  <dt className="font-semibold">{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <h2 className="heading-flare mt-8 text-xl">
            How {technique.label.toLowerCase()} is made
          </h2>
          <p className="mt-2 max-w-[36rem]">{technique.how}</p>

          <h2 className="heading-flare mt-8 text-xl">Delivery</h2>
          <p className="mt-2 max-w-[36rem]">
            {formatNaira(DELIVERY_ZONES.lagos.feeKobo)} in Lagos, {formatNaira(DELIVERY_ZONES["south-west"].feeKobo)} in the
            rest of the South-West and {formatNaira(DELIVERY_ZONES["rest-of-nigeria"].feeKobo)} elsewhere. Free on orders
            of {formatNaira(FREE_DELIVERY_FROM_KOBO)} or more.
          </p>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="mt-20">
          <h2 id="related-title" className="font-stencil text-4xl">
            More from the shop
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
