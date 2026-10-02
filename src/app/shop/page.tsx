import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/products";
import { CATEGORIES, TECHNIQUES, isCategory, isTechnique, type Category, type Technique } from "@/lib/catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function readFilters(searchParams: SearchParams) {
  const params = await searchParams;
  return {
    category: isCategory(params.category) ? params.category : undefined,
    technique: isTechnique(params.technique) ? params.technique : undefined,
  };
}

function titleFor(category?: Category, technique?: Technique): string {
  if (category && technique) return `${TECHNIQUES[technique].label} ${CATEGORIES[category].label.toLowerCase()}`;
  if (category) return CATEGORIES[category].label;
  if (technique) return `${TECHNIQUES[technique].label} pieces`;
  return "All adire";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { category, technique } = await readFilters(searchParams);
  return { title: titleFor(category, technique) };
}

function shopHref(category?: Category, technique?: Technique) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (technique) params.set("technique", technique);
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

function FilterLinks<T extends string>({
  label,
  options,
  current,
  href,
}: {
  label: string;
  options: { value: T | undefined; label: string }[];
  current: T | undefined;
  href: (value: T | undefined) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-faded">{label}</span>
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.label}
            href={href(option.value)}
            aria-current={active ? "page" : undefined}
            className={`min-h-10 border px-3.5 py-1.5 text-sm font-semibold no-underline ${
              active ? "border-pit bg-pit text-starch" : "border-line text-pit hover:border-pit"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const { category, technique } = await readFilters(searchParams);
  const products = await listProducts({ category, technique });
  const title = titleFor(category, technique);

  return (
    <div className="mx-auto max-w-[76rem] px-4 pt-12 sm:px-6 lg:px-8">
      <h1 className="font-stencil text-6xl">{title}</h1>
      <p className="mt-3 max-w-[40rem] text-lg">
        {technique
          ? TECHNIQUES[technique].how
          : "Every piece is cotton, dyed in indigo by hand, so patterns and shades vary a little from the photos."}
      </p>

      <div className="mt-8 flex flex-col gap-3 border-y border-wash py-4">
        <FilterLinks
          label="Type"
          current={category}
          options={[
            { value: undefined, label: "All" },
            ...(Object.keys(CATEGORIES) as Category[]).map((value) => ({ value, label: CATEGORIES[value].label })),
          ]}
          href={(value) => shopHref(value, technique)}
        />
        <FilterLinks
          label="Technique"
          current={technique}
          options={[
            { value: undefined, label: "Any" },
            ...(Object.keys(TECHNIQUES) as Technique[]).map((value) => ({ value, label: TECHNIQUES[value].label })),
          ]}
          href={(value) => shopHref(category, value)}
        />
      </div>

      <p className="mt-6 text-sm text-faded" aria-live="polite">
        {products.length === 1 ? "1 piece" : `${products.length} pieces`}
      </p>

      {products.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} headingLevel={2} />
          ))}
        </div>
      ) : (
        <div className="mt-6 max-w-[34rem]">
          <p className="text-lg">Nothing matches both of those right now.</p>
          <p className="mt-2">
            <Link href={shopHref(category, undefined)} className="link font-semibold">
              Show all {category ? CATEGORIES[category].label.toLowerCase() : "pieces"}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
