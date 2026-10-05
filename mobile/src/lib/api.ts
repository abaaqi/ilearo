import { shopUrl } from "./config";
import type {
  Cart,
  CartChangeResponse,
  CartFeedResponse,
  CheckoutField,
  CheckoutInfo,
  Order,
  OrderSummary,
  Product,
  ProductDetail,
  ShopInfo,
  User,
} from "./types";

/**
 * The shop's JSON API: the same server and database as the website.
 *
 * Signed in, requests carry the app's session token. Signed out, they carry
 * the guest cart's id (once there is one), just as the website uses cookies.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The server says this session is no longer valid. */
  get signedOut(): boolean {
    return this.status === 401 && this.body?.signedOut === true;
  }

  get fieldErrors(): Partial<Record<CheckoutField, string>> {
    return (this.body?.fieldErrors as Partial<Record<CheckoutField, string>> | undefined) ?? {};
  }

  get cartChanged(): boolean {
    return this.body?.cartChanged === true;
  }
}

/** Requests cancelled on purpose (the app went to the background, a screen closed) reject with this. */
export const isAbort = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

function abortError(): Error {
  const error = new Error("The request was cancelled.");
  error.name = "AbortError";
  return error;
}

type Credentials = { token: string | null; guestCartId: string | null };
let credentials: Credentials = { token: null, guestCartId: null };
let onSignedOut: (() => void) | null = null;

/** Called by the session provider whenever the token or guest cart changes. */
export function setCredentials(next: Credentials) {
  credentials = next;
}

/** Called when the server says the stored token has stopped working. */
export function setSignedOutHandler(handler: (() => void) | null) {
  onSignedOut = handler;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Gives up after this long, so a dead connection doesn't hang a screen. */
  timeoutMs?: number;
};

async function request<T>(path: string, { method = "GET", body, signal, timeoutMs = 15_000 }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (credentials.token) headers.Authorization = `Bearer ${credentials.token}`;
  else if (credentials.guestCartId) headers["X-Guest-Cart"] = credentials.guestCartId;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort);

  // Expo's fetch doesn't name its errors AbortError, so ask the signal whether the caller cancelled.
  const cancelled = () => controller.signal.aborted && !timedOut;

  let response: Response;
  let data: Record<string, unknown> | null;
  try {
    response = await fetch(shopUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    if (cancelled()) throw abortError();
    throw new ApiError(0, "Can't reach the shop. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
  if (cancelled()) throw abortError();

  if (response.ok && data === null) throw new ApiError(0, "The shop's answer didn't come through. Try again.");
  if (!response.ok) {
    const error = new ApiError(
      response.status,
      typeof data?.error === "string" ? data.error : `The shop answered with an error (${response.status}). Try again in a moment.`,
      data,
    );
    if (error.signedOut && credentials.token) onSignedOut?.();
    throw error;
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  shop: () => request<{ shop: ShopInfo }>("/api/v1/shop"),

  products: (filter: { category?: string | null } = {}) =>
    request<{ products: Product[] }>(`/api/v1/products${filter.category ? `?category=${enc(filter.category)}` : ""}`),

  product: (slug: string) => request<{ product: ProductDetail }>(`/api/v1/products/${enc(slug)}`),

  me: () => request<{ user: User }>("/api/v1/me"),

  cart: () => request<{ cart: Cart }>("/api/v1/cart"),

  addToCart: (productId: string, quantity: number) =>
    request<CartChangeResponse>("/api/v1/cart/items", { method: "POST", body: { productId, quantity } }),

  setQuantity: (productId: string, quantity: number) =>
    request<CartChangeResponse>(`/api/v1/cart/items/${enc(productId)}`, { method: "PUT", body: { quantity } }),

  removeFromCart: (productId: string) => request<CartChangeResponse>(`/api/v1/cart/items/${enc(productId)}`, { method: "DELETE" }),

  /**
   * The live cart feed. Answers at once if the cart's version isn't `after`,
   * otherwise waits (up to 8 seconds on the server) for the next change.
   */
  cartChanges: (after: number | null, signal?: AbortSignal) =>
    request<CartFeedResponse>(`/api/v1/cart/changes${after === null ? "" : `?after=${after}`}`, { signal, timeoutMs: 25_000 }),

  checkout: () => request<CheckoutInfo>("/api/v1/checkout"),

  /** Answers with the order's reference and the cart, now empty. */
  placeOrder: (values: Record<CheckoutField, string>) =>
    request<{ reference: string; alreadyPlaced?: boolean; cart: Cart }>("/api/v1/orders", { method: "POST", body: values }),

  orders: () => request<{ orders: OrderSummary[] }>("/api/v1/orders"),

  order: (reference: string) => request<{ order: Order }>(`/api/v1/orders/${enc(reference)}`),

  exchangeSignInCode: (body: { code: string; codeVerifier: string; guestCartId: string | null; device: string }) =>
    request<{ token: string; expiresAt: string; user: User }>("/api/v1/auth/token", { method: "POST", body }),

  signOut: () => request<{ ok: true }>("/api/v1/auth/sign-out", { method: "POST", body: {} }),
};
