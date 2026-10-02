import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db, isUuid } from "./db";
import { usesHttps } from "./env";
import { getCurrentUser } from "./auth/session";
import { MAX_PER_ITEM, type Category, type Technique } from "./catalog";
import { seedFromString, toArtSpec, type ArtSpec } from "@/components/adire/art";

/** Guests' carts are found through this cookie. Signed-in carts belong to the user. */
export const CART_COOKIE = "ia_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type CartProblem = "unavailable" | "sold-out" | "short";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  category: Category;
  technique: Technique;
  priceKobo: number;
  quantity: number;
  stock: number;
  art: ArtSpec;
  imageUrl: string | null;
  lineTotalKobo: number;
  /** Set when the line can't be bought as it stands. */
  problem: CartProblem | null;
};

export type Cart = {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotalKobo: number;
  hasProblems: boolean;
};

const EMPTY_CART: Cart = { id: null, lines: [], itemCount: 0, subtotalKobo: 0, hasProblems: false };

async function findCartId(): Promise<string | null> {
  const sql = db();
  const user = await getCurrentUser();
  if (user) {
    const [row] = await sql<{ id: string }[]>`select id from carts where user_id = ${user.id}`;
    return row?.id ?? null;
  }
  const cookieValue = (await cookies()).get(CART_COOKIE)?.value;
  if (!isUuid(cookieValue)) return null;
  const [row] = await sql<{ id: string }[]>`select id from carts where id = ${cookieValue} and user_id is null`;
  return row?.id ?? null;
}

type LineRow = Omit<CartLine, "art" | "lineTotalKobo" | "problem"> & { art: unknown; active: boolean };

export function lineProblem(line: { active: boolean; stock: number; quantity: number }): CartProblem | null {
  if (!line.active) return "unavailable";
  if (line.stock === 0) return "sold-out";
  if (line.quantity > line.stock) return "short";
  return null;
}

/** The current visitor's cart with live prices and stock. Cached per request. */
export const getCart = cache(async (): Promise<Cart> => {
  const id = await findCartId();
  if (!id) return EMPTY_CART;
  const sql = db();
  const rows = await sql<LineRow[]>`
    select p.id as product_id, p.slug, p.name, p.category, p.technique, p.price_kobo,
           p.stock, p.active, p.art, p.image_url, ci.quantity
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = ${id}
    order by ci.added_at, p.name
  `;
  const lines: CartLine[] = rows.map(({ active, art, ...row }) => ({
    ...row,
    art: toArtSpec(art, seedFromString(row.slug)),
    lineTotalKobo: row.priceKobo * row.quantity,
    problem: lineProblem({ active, stock: row.stock, quantity: row.quantity }),
  }));
  return {
    id,
    lines,
    itemCount: lines.reduce((n, line) => n + line.quantity, 0),
    subtotalKobo: lines.reduce((n, line) => n + line.lineTotalKobo, 0),
    hasProblems: lines.some((line) => line.problem !== null),
  };
});

/** Returns the visitor's cart id, creating the cart (and guest cookie) if needed. Server Actions only. */
export async function getOrCreateCartId(): Promise<string> {
  const sql = db();
  const user = await getCurrentUser();
  if (user) {
    const [row] = await sql<{ id: string }[]>`
      insert into carts (user_id) values (${user.id})
      on conflict (user_id) do update set updated_at = now()
      returning id
    `;
    if (!row) throw new Error("Could not create a cart");
    return row.id;
  }

  const existing = await findCartId();
  if (existing) return existing;

  const [row] = await sql<{ id: string }[]>`insert into carts default values returning id`;
  if (!row) throw new Error("Could not create a cart");
  (await cookies()).set(CART_COOKIE, row.id, {
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
  return row.id;
}

/** Quantity of one product already in a cart (0 if none). */
export async function quantityInCart(cartId: string, productId: string): Promise<number> {
  const sql = db();
  const [row] = await sql<{ quantity: number }[]>`
    select quantity from cart_items where cart_id = ${cartId} and product_id = ${productId}
  `;
  return row?.quantity ?? 0;
}

/** Sets an exact quantity (0 removes the line). Returns the quantity saved. */
export async function setLineQuantity(cartId: string, productId: string, quantity: number): Promise<number> {
  const sql = db();
  if (quantity <= 0) {
    await sql`delete from cart_items where cart_id = ${cartId} and product_id = ${productId}`;
  } else {
    await sql`
      insert into cart_items (cart_id, product_id, quantity)
      values (${cartId}, ${productId}, ${quantity})
      on conflict (cart_id, product_id) do update set quantity = excluded.quantity
    `;
  }
  await sql`update carts set updated_at = now() where id = ${cartId}`;
  return Math.max(quantity, 0);
}

/**
 * Moves a guest cart's items into the user's own cart when they sign in.
 * Quantities for the same product are added together, capped at MAX_PER_ITEM.
 */
export async function mergeGuestCart(guestCartId: string, userId: string): Promise<void> {
  if (!isUuid(guestCartId)) return;
  await db().begin(async (sql) => {
    const [guest] = await sql<{ id: string }[]>`
      select id from carts where id = ${guestCartId} and user_id is null for update
    `;
    if (!guest) return;
    const [mine] = await sql<{ id: string }[]>`
      insert into carts (user_id) values (${userId})
      on conflict (user_id) do update set updated_at = now()
      returning id
    `;
    if (!mine) return;
    await sql`
      insert into cart_items (cart_id, product_id, quantity, added_at)
      select ${mine.id}, product_id, least(quantity, ${MAX_PER_ITEM}), added_at
      from cart_items where cart_id = ${guest.id}
      on conflict (cart_id, product_id)
      do update set quantity = least(cart_items.quantity + excluded.quantity, ${MAX_PER_ITEM})
    `;
    await sql`delete from carts where id = ${guest.id}`;
  });
}
