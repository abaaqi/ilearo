import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db, isUuid, type TransactionSql } from "./db";
import { usesHttps } from "./env";
import { getCurrentUser } from "./auth/session";
import { MAX_PER_ITEM, type Category, type Technique } from "./catalog";
import { getProductById } from "./products";
import { seedFromString, toArtSpec, type ArtSpec } from "@/components/adire/art";

/** Guests' carts are found through this cookie on the website. Signed-in carts belong to the user. */
export const CART_COOKIE = "ia_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

/** Where a cart change was made. Recorded with every change so the other side can say so. */
export type CartClient = "web" | "app";

/**
 * Whose cart. A signed-in shopper has exactly one cart, shared by the website
 * and the app. A guest cart is found by its id: a cookie on the website, a
 * header from the app.
 */
export type CartOwner = { userId: string } | { guestCartId: string | null };

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
  /** Goes up with every change to the cart's items (0 for a cart that has never changed). */
  version: number;
  /** Where the latest change was made, when known. */
  changedVia: CartClient | null;
  lines: CartLine[];
  itemCount: number;
  subtotalKobo: number;
  hasProblems: boolean;
};

const EMPTY_CART: Cart = {
  id: null,
  version: 0,
  changedVia: null,
  lines: [],
  itemCount: 0,
  subtotalKobo: 0,
  hasProblems: false,
};

export type CartState = { id: string; version: number; changedVia: CartClient | null };

/** The owner's cart row (id and version), without its items. */
export async function findCart(owner: CartOwner): Promise<CartState | null> {
  if (!("userId" in owner) && !isUuid(owner.guestCartId)) {
    // First-time visitors have no guest cart yet, so they never touch the database here.
    return null;
  }
  const sql = db();
  // Versions are bigints; they stay far below 2^53, so a JS number holds them exactly.
  const [row] =
    "userId" in owner
      ? await sql<{ id: string; version: number; changedVia: string | null }[]>`
          select id, version::float8 as version, changed_via from carts where user_id = ${owner.userId}`
      : await sql<{ id: string; version: number; changedVia: string | null }[]>`
          select id, version::float8 as version, changed_via from carts where id = ${owner.guestCartId} and user_id is null`;
  if (!row) return null;
  const changedVia = row.changedVia === "web" || row.changedVia === "app" ? row.changedVia : null;
  return { id: row.id, version: row.version, changedVia };
}

type LineRow = Omit<CartLine, "art" | "lineTotalKobo" | "problem"> & { art: unknown; active: boolean };

export function lineProblem(line: { active: boolean; stock: number; quantity: number }): CartProblem | null {
  if (!line.active) return "unavailable";
  if (line.stock === 0) return "sold-out";
  if (line.quantity > line.stock) return "short";
  return null;
}

/** What to tell the shopper about a line that can't be bought as it stands. */
export function cartProblemText(line: Pick<CartLine, "problem" | "stock">): string | null {
  switch (line.problem) {
    case "unavailable":
      return "No longer for sale. Remove it to check out.";
    case "sold-out":
      return "Sold out since you added it. Remove it to check out.";
    case "short":
      return `Only ${line.stock} left. Lower the quantity to check out.`;
    default:
      return null;
  }
}

/**
 * The owner's cart with live prices and stock.
 *
 * The version is read before the items. If the cart changes in between, the
 * caller holds newer items under an older version number, and its next
 * "has it changed?" check fetches the cart again. The other way round could
 * hide a change, so keep this order.
 */
export async function loadCart(owner: CartOwner): Promise<Cart> {
  const state = await findCart(owner);
  if (!state) return EMPTY_CART;
  const sql = db();
  const rows = await sql<LineRow[]>`
    select p.id as product_id, p.slug, p.name, p.category, p.technique, p.price_kobo,
           p.stock, p.active, p.art, p.image_url, ci.quantity
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = ${state.id}
    order by ci.added_at, p.name
  `;
  const lines: CartLine[] = rows.map(({ active, art, ...row }) => ({
    ...row,
    art: toArtSpec(art, seedFromString(row.slug)),
    lineTotalKobo: row.priceKobo * row.quantity,
    problem: lineProblem({ active, stock: row.stock, quantity: row.quantity }),
  }));
  return {
    ...state,
    lines,
    itemCount: lines.reduce((n, line) => n + line.quantity, 0),
    subtotalKobo: lines.reduce((n, line) => n + line.lineTotalKobo, 0),
    hasProblems: lines.some((line) => line.problem !== null),
  };
}

/** The website visitor's cart owner: their account if signed in, otherwise the guest cookie. */
export async function currentCartOwner(): Promise<CartOwner> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  return { guestCartId: (await cookies()).get(CART_COOKIE)?.value ?? null };
}

/** The current website visitor's cart. Cached per request. */
export const getCart = cache(async (): Promise<Cart> => loadCart(await currentCartOwner()));

/** The owner's cart id, creating an empty cart if there isn't one yet. */
export async function ensureCart(owner: CartOwner): Promise<{ id: string; created: boolean }> {
  const sql = db();
  if ("userId" in owner) {
    const [row] = await sql<{ id: string }[]>`
      insert into carts (user_id) values (${owner.userId})
      on conflict (user_id) do update set updated_at = now()
      returning id
    `;
    if (!row) throw new Error("Could not create a cart");
    return { id: row.id, created: false };
  }
  const existing = await findCart(owner);
  if (existing) return { id: existing.id, created: false };
  const [row] = await sql<{ id: string }[]>`insert into carts default values returning id`;
  if (!row) throw new Error("Could not create a cart");
  return { id: row.id, created: true };
}

/** Points the guest cookie at a newly created guest cart. Server Actions only. */
export async function rememberGuestCart(cartId: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

/**
 * Runs one change to a cart in a transaction that holds the cart row's lock,
 * so two clients changing the same cart at once take turns. The database
 * trigger on cart_items gives the cart its new version and records `client`.
 */
async function changeCart<T>(cartId: string, client: CartClient, change: (sql: TransactionSql) => Promise<T>): Promise<T> {
  const result = await db().begin(async (sql) => {
    await sql`select set_config('ile_aro.client', ${client}, true)`;
    await sql`select 1 from carts where id = ${cartId} for update`;
    return change(sql);
  });
  return result as T;
}

async function writeQuantity(sql: TransactionSql, cartId: string, productId: string, quantity: number) {
  if (quantity <= 0) {
    await sql`delete from cart_items where cart_id = ${cartId} and product_id = ${productId}`;
  } else {
    await sql`
      insert into cart_items (cart_id, product_id, quantity)
      values (${cartId}, ${productId}, ${quantity})
      on conflict (cart_id, product_id) do update set quantity = excluded.quantity
    `;
  }
}

export type CartChange = { ok: boolean; message: string };

/**
 * Adds up to `quantity` of a product, capped by stock and MAX_PER_ITEM.
 * The website and the app both use this, so the rules and wording match.
 */
export async function addItem(
  owner: CartOwner,
  productId: string,
  quantity: number,
  client: CartClient,
): Promise<CartChange & { cart: { id: string; created: boolean } | null }> {
  const product = await getProductById(productId);
  if (!product) return { ok: false, message: "This piece is no longer for sale.", cart: null };
  if (product.stock <= 0) return { ok: false, message: "This piece has just sold out.", cart: null };

  const cart = await ensureCart(owner);
  const limit = Math.min(product.stock, MAX_PER_ITEM);
  const change = await changeCart(cart.id, client, async (sql): Promise<CartChange> => {
    const [row] = await sql<{ quantity: number }[]>`
      select quantity from cart_items where cart_id = ${cart.id} and product_id = ${product.id}
    `;
    const current = row?.quantity ?? 0;
    if (current >= limit) {
      const message =
        limit === product.stock
          ? `You already have all ${product.stock} we have in your cart.`
          : `You can have up to ${MAX_PER_ITEM} of one piece in your cart.`;
      return { ok: false, message };
    }
    const next = Math.min(current + quantity, limit);
    await writeQuantity(sql, cart.id, product.id, next);
    const added = next - current;
    const message =
      added < quantity
        ? `Added ${added}, which is all we have. You have ${next} in your cart.`
        : `Added to your cart. You have ${next}.`;
    return { ok: true, message };
  });
  return { ...change, cart };
}

/** The − and + buttons: going down is always allowed, going up only while stock lasts. */
export async function changeQuantity(
  owner: CartOwner,
  productId: string,
  quantity: number,
  client: CartClient,
): Promise<CartChange> {
  const notInCart: CartChange = { ok: false, message: "That piece isn't in your cart any more." };
  const cart = await findCart(owner);
  if (!cart || !isUuid(productId)) return notInCart;
  return changeCart(cart.id, client, async (sql): Promise<CartChange> => {
    const [line] = await sql<{ quantity: number; stock: number; active: boolean }[]>`
      select ci.quantity, p.stock, p.active
      from cart_items ci join products p on p.id = ci.product_id
      where ci.cart_id = ${cart.id} and ci.product_id = ${productId}
    `;
    if (!line) return notInCart;
    if (quantity > line.quantity) {
      if (!line.active || line.stock <= 0) return { ok: false, message: "This piece has sold out." };
      if (quantity > line.stock) return { ok: false, message: `Only ${line.stock} left, and you have ${line.quantity}.` };
      if (quantity > MAX_PER_ITEM) return { ok: false, message: `You can have up to ${MAX_PER_ITEM} of one piece in your cart.` };
    }
    await writeQuantity(sql, cart.id, productId, quantity);
    return { ok: true, message: quantity <= 0 ? "Removed from your cart." : `You have ${quantity}.` };
  });
}

/** Takes a product out of the cart. Removing something that isn't there is fine. */
export async function removeItem(owner: CartOwner, productId: string, client: CartClient): Promise<CartChange> {
  const cart = await findCart(owner);
  if (cart && isUuid(productId)) {
    await changeCart(cart.id, client, (sql) => writeQuantity(sql, cart.id, productId, 0));
  }
  return { ok: true, message: "Removed from your cart." };
}

/**
 * Moves a guest cart's items into the user's own cart when they sign in.
 * Quantities for the same product are added together, capped at MAX_PER_ITEM.
 */
export async function mergeGuestCart(guestCartId: string, userId: string, client: CartClient = "web"): Promise<void> {
  if (!isUuid(guestCartId)) return;
  await db().begin(async (sql) => {
    await sql`select set_config('ile_aro.client', ${client}, true)`;
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
