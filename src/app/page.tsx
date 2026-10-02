import Link from "next/link";
import { HeroCloth } from "@/components/hero-cloth";
import { ProductCard } from "@/components/product-card";
import { AdireArt } from "@/components/adire/art";
import { getFeaturedProducts } from "@/lib/products";
import { TECHNIQUES, type Technique } from "@/lib/catalog";

const TECHNIQUE_SWATCHES: Record<Technique, Parameters<typeof AdireArt>[0]["spec"]> = {
  oniko: { pattern: "moons", seed: 404, tone: "deep" },
  alabere: { pattern: "stripes", seed: 77, tone: "deep" },
  eleko: { pattern: "panels", seed: 512, tone: "deep" },
};

export default async function HomePage() {
  const featured = await getFeaturedProducts(4);

  return (
    <>
      <HeroCloth />

      <section aria-labelledby="featured-title" className="mx-auto max-w-[76rem] px-4 pt-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="featured-title" className="font-stencil text-5xl">
            A few to start with
          </h2>
          <Link href="/shop" className="link font-semibold">
            See everything in the shop
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section id="techniques" aria-labelledby="techniques-title" className="mx-auto max-w-[76rem] scroll-mt-6 px-4 pt-24 sm:px-6 lg:px-8">
        <h2 id="techniques-title" className="font-stencil text-5xl">
          Three ways to keep the dye out
        </h2>
        <p className="mt-4 max-w-[38rem] text-lg">
          Adire is resist-dyed: before the cloth goes into the indigo, part of it is protected so the dye can&apos;t
          reach it. How it&apos;s protected decides the pattern.
        </p>
        <div className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-3">
          {(Object.keys(TECHNIQUES) as Technique[]).map((key) => (
            <article key={key} className="flex flex-col">
              <div className="aspect-[4/3] overflow-hidden">
                <AdireArt spec={TECHNIQUE_SWATCHES[key]} className="block h-full w-full" />
              </div>
              <h3 className="mt-4 font-stencil text-3xl">
                {TECHNIQUES[key].label}
                <span className="ml-3 align-middle font-sans text-base font-semibold tracking-normal text-faded">
                  {TECHNIQUES[key].short}
                </span>
              </h3>
              <p className="mt-2 max-w-[32rem]">{TECHNIQUES[key].how}</p>
              <p className="mt-3">
                <Link href={`/shop?technique=${key}`} className="link font-semibold">
                  Shop {TECHNIQUES[key].label.toLowerCase()} pieces
                </Link>
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
