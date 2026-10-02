import "server-only";
import { cache } from "react";
import { db, type Sql } from "./db";
import type { Category, Technique } from "./catalog";
import { seedFromString, toArtSpec, type ArtSpec } from "@/components/adire/art";

export type Product = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: Category;
  technique: Technique;
  priceKobo: number;
  stock: number;
  details: [string, string][];
  art: ArtSpec;
  imageUrl: string | null;
  featured: boolean;
};

type ProductRow = Omit<Product, "art" | "details"> & { art: unknown; details: unknown };

const columns = (sql: Sql) =>
  sql`id, slug, name, summary, description, category, technique, price_kobo, stock, details, art, image_url, featured`;

function toDetails(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (pair): pair is [string, string] =>
      Array.isArray(pair) && pair.length === 2 && typeof pair[0] === "string" && typeof pair[1] === "string",
  );
}

function toProduct(row: ProductRow): Product {
  return { ...row, details: toDetails(row.details), art: toArtSpec(row.art, seedFromString(row.slug)) };
}

export async function listProducts(filter: { category?: Category; technique?: Technique } = {}): Promise<Product[]> {
  const sql = db();
  const rows = await sql<ProductRow[]>`
    select ${columns(sql)}
    from products
    where active
      ${filter.category ? sql`and category = ${filter.category}` : sql``}
      ${filter.technique ? sql`and technique = ${filter.technique}` : sql``}
    order by sort_order, name
  `;
  return rows.map(toProduct);
}

export async function getFeaturedProducts(limit = 5): Promise<Product[]> {
  const sql = db();
  const rows = await sql<ProductRow[]>`
    select ${columns(sql)} from products
    where active and featured
    order by sort_order, name
    limit ${limit}
  `;
  return rows.map(toProduct);
}

/** Cached per request, so the page and its metadata share one query. */
export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const sql = db();
  const [row] = await sql<ProductRow[]>`
    select ${columns(sql)} from products where slug = ${slug} and active
  `;
  return row ? toProduct(row) : null;
});

export async function getProductById(id: string): Promise<Product | null> {
  const sql = db();
  const [row] = await sql<ProductRow[]>`
    select ${columns(sql)} from products where id = ${id} and active
  `;
  return row ? toProduct(row) : null;
}

/** Pieces made the same way first, then anything else. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const sql = db();
  const rows = await sql<ProductRow[]>`
    select ${columns(sql)} from products
    where active and id <> ${product.id} and stock > 0
    order by (technique = ${product.technique}) desc, sort_order
    limit ${limit}
  `;
  return rows.map(toProduct);
}
