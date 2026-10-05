import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, userForAppToken, type SessionUser } from "./auth/session";
import { CART_COOKIE, cartProblemText, type Cart, type CartClient, type CartOwner } from "./cart";
import { CATEGORIES, MAX_PER_ITEM, TECHNIQUES } from "./catalog";
import { isUuid } from "./db";
import { appUrl, bankDetails, supportEmail } from "./env";
import { PAYMENT_METHOD_LABELS } from "./checkout-schema";
import { formatDate, formatDateTime } from "./dates";
import { ORDER_STATUS_LABELS, paymentSummary, type OrderDetail, type OrderSummary } from "./orders";
import { formatNigerianPhone } from "./phone";
import type { Product } from "./products";
import { DELIVERY_ZONES, FREE_DELIVERY_FROM_KOBO, NIGERIAN_STATES, isNigerianState, zoneForState } from "./shipping";
import { SHOP } from "./shop";
import { artPath } from "./art-svg";
import { describeArt, type ArtSpec } from "@/components/adire/art";

/**
 * The JSON API under /api/v1, used by the mobile app (and, for the live cart
 * feed, by the website). It calls the same functions as the website's pages
 * and forms, so both see the same products, cart, orders and rules.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiJson(body: unknown, status = 200): NextResponse {
  // Every answer is about this shopper, right now: never cache it anywhere.
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(status: number, message: string, extra: Record<string, unknown> = {}): NextResponse {
  return apiJson({ error: message, ...extra }, status);
}

/** Wraps a route handler: an ApiError becomes its response; anything else a 500 that gives nothing away. */
export function apiRoute<Context>(handler: (request: NextRequest, context: Context) => Promise<Response>) {
  return async (request: NextRequest, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return apiError(error.status, error.message, error.extra);
      console.error(`[api] ${request.method} ${request.nextUrl.pathname} failed:`, error);
      return apiError(500, "Something went wrong on our side. Try again in a moment.");
    }
  };
}

/** The request body as JSON. Requiring JSON also means a plain HTML form on another site can't post here. */
export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Send the request body as JSON.");
  }
  const body: unknown = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "That request body isn't valid JSON.");
  return body as Record<string, unknown>;
}

export type ApiCaller = {
  user: SessionUser | null;
  owner: CartOwner;
  client: CartClient;
};

/**
 * Who is calling:
 *
 *   the app, signed in     Authorization: Bearer <app session token>
 *   the app, signed out    X-Guest-Cart: <guest cart id>, once it has a cart
 *   the website            its session and cart cookies, for reading only
 *
 * Changes are only ever made for the app's headers, never for cookies, so
 * another website can't change a visitor's cart behind their back.
 */
export async function apiCaller(request: NextRequest, options: { cookies?: boolean } = {}): Promise<ApiCaller> {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const token = /^Bearer\s+(\S+)\s*$/i.exec(authorization)?.[1];
    const user = token ? await userForAppToken(token) : null;
    if (!user) throw new ApiError(401, "You've been signed out. Sign in again to carry on.", { signedOut: true });
    return { user, owner: { userId: user.id }, client: "app" };
  }

  const guestHeader = request.headers.get("x-guest-cart");
  if (guestHeader !== null || !options.cookies) {
    return { user: null, owner: { guestCartId: isUuid(guestHeader) ? guestHeader : null }, client: "app" };
  }

  const user = await getCurrentUser();
  const owner: CartOwner = user ? { userId: user.id } : { guestCartId: request.cookies.get(CART_COOKIE)?.value ?? null };
  return { user, owner, client: "web" };
}

export function requireUser(caller: ApiCaller): SessionUser {
  if (!caller.user) throw new ApiError(401, "Sign in to carry on.", { signedOut: true });
  return caller.user;
}

/* ------------------------------------------------------------- shapes */

export function apiUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: (user.name ?? user.email).trim().split(/[\s@]+/)[0] ?? user.email,
    avatarUrl: user.avatarUrl,
  };
}

/** A photo if the product has one, otherwise its generated swatch. Relative URLs are on the shop's own address. */
function apiImage(item: { art: ArtSpec; imageUrl: string | null; name: string }) {
  return item.imageUrl
    ? { url: item.imageUrl, kind: "photo" as const, description: item.name }
    : { url: artPath(item.art), kind: "art" as const, description: describeArt(item.art) };
}

export function apiProduct(product: Product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    category: product.category,
    categoryLabel: CATEGORIES[product.category].label,
    technique: product.technique,
    techniqueLabel: TECHNIQUES[product.technique].label,
    techniqueShort: TECHNIQUES[product.technique].short,
    priceKobo: product.priceKobo,
    stock: product.stock,
    /** The most a shopper can add: what's in stock, up to the per-item limit. */
    maxQuantity: Math.max(0, Math.min(product.stock, MAX_PER_ITEM)),
    image: apiImage(product),
  };
}

export function apiProductDetail(product: Product, related: Product[]) {
  const technique = TECHNIQUES[product.technique];
  return {
    ...apiProduct(product),
    description: product.description,
    details: product.details.map(([label, value]) => ({ label, value })),
    techniqueHow: technique.how,
    related: related.map(apiProduct),
  };
}

export function apiCart(cart: Cart) {
  return {
    /** Send this back to /api/v1/cart/changes?after= to hear about the next change. */
    version: cart.version,
    changedVia: cart.changedVia,
    itemCount: cart.itemCount,
    subtotalKobo: cart.subtotalKobo,
    hasProblems: cart.hasProblems,
    lines: cart.lines.map((line) => ({
      productId: line.productId,
      slug: line.slug,
      name: line.name,
      techniqueLabel: TECHNIQUES[line.technique].label,
      priceKobo: line.priceKobo,
      quantity: line.quantity,
      stock: line.stock,
      lineTotalKobo: line.lineTotalKobo,
      problem: line.problem,
      problemText: cartProblemText(line),
      canAddOne: line.quantity < Math.min(line.stock, MAX_PER_ITEM) && line.problem !== "unavailable",
      image: apiImage(line),
    })),
  };
}

/** Everything about the shop that the app needs to draw its screens. */
export function apiShopInfo() {
  return {
    name: SHOP.name,
    description: SHOP.description,
    website: appUrl(),
    supportEmail: supportEmail(),
    categories: Object.entries(CATEGORIES).map(([key, category]) => ({ key, label: category.label })),
    techniques: Object.entries(TECHNIQUES).map(([key, technique]) => ({ key, ...technique })),
    states: NIGERIAN_STATES.map((name) => ({ name, zone: zoneForState(name) })),
    deliveryZones: Object.entries(DELIVERY_ZONES).map(([key, zone]) => ({ key, ...zone })),
    freeDeliveryFromKobo: FREE_DELIVERY_FROM_KOBO,
    maxPerItem: MAX_PER_ITEM,
    bankTransfer: bankDetails() !== null,
  };
}

export function apiOrderSummary(order: OrderSummary) {
  return {
    reference: order.reference,
    createdAt: order.createdAt.toISOString(),
    placedOn: formatDate(order.createdAt),
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalKobo: order.totalKobo,
    itemCount: order.itemCount,
  };
}

export function apiOrder(order: OrderDetail) {
  const bank = bankDetails();
  const awaitingTransfer = order.paymentMethod === "bank_transfer" && order.paymentStatus === "unpaid";
  return {
    reference: order.reference,
    createdAt: order.createdAt.toISOString(),
    placedAt: formatDateTime(order.createdAt),
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[order.paymentMethod],
    paymentStatus: order.paymentStatus,
    paymentLabel: paymentSummary(order),
    awaitingTransfer,
    /** Where to send the money, while a bank transfer is outstanding. */
    bankTransfer: awaitingTransfer && bank ? { ...bank, narration: order.reference } : null,
    email: order.email,
    customerName: order.customerName,
    phone: formatNigerianPhone(order.phone),
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    state: order.state,
    deliveryNotes: order.deliveryNotes,
    deliveryDays: isNigerianState(order.state) ? DELIVERY_ZONES[zoneForState(order.state)].days : null,
    subtotalKobo: order.subtotalKobo,
    deliveryKobo: order.deliveryKobo,
    totalKobo: order.totalKobo,
    items: order.items.map((item) => ({
      productSlug: item.productSlug,
      productName: item.productName,
      unitPriceKobo: item.unitPriceKobo,
      quantity: item.quantity,
      lineTotalKobo: item.lineTotalKobo,
      stillListed: item.stillListed,
      image: apiImage({ art: item.art, imageUrl: item.imageUrl, name: item.productName }),
    })),
  };
}
