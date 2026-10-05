import * as Haptics from "expo-haptics";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { ApiError, api, isAbort } from "@/lib/api";
import type { Cart, CartChangeResponse, CheckoutField } from "@/lib/types";
import { errorMessage } from "@/lib/use-resource";
import { useSession } from "./session";

/*
 * The cart, kept in step with the website.
 *
 * A signed-in shopper has one cart on the server, shared by the website and
 * this app. While the app is open, it keeps one request waiting on
 * /api/v1/cart/changes. The server answers the moment the cart's version
 * changes (it checks every 400 ms), and the app asks again straight away. So
 * an item added on the website shows up here within about a second.
 */

export type LiveStatus = "off" | "connecting" | "live" | "offline";

/** A change that arrived from the website or another phone, to announce. */
export type RemoteChange = { id: number; where: "website" | "another device"; text: string };

type CartValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  live: LiveStatus;
  remoteChange: RemoteChange | null;
  /** Product ids with a change on its way to the server. */
  pending: ReadonlySet<string>;
  reload: () => Promise<void>;
  add: (productId: string, quantity: number) => Promise<{ ok: boolean; message: string }>;
  setQuantity: (productId: string, quantity: number) => Promise<{ ok: boolean; message: string }>;
  remove: (productId: string) => Promise<{ ok: boolean; message: string }>;
  /** Places the order; the server empties the cart, which isn't news to announce. */
  placeOrder: (values: Record<CheckoutField, string>) => Promise<{ reference: string }>;
  dismissRemoteChange: () => void;
};

const CartContext = createContext<CartValue | null>(null);

/** "Oniko bucket hat added", in words, from the difference between two carts. */
export function describeChange(before: Cart, after: Cart): string {
  const old = new Map(before.lines.map((line) => [line.productId, line]));
  const added = after.lines.filter((line) => (old.get(line.productId)?.quantity ?? 0) < line.quantity);
  const removed = before.lines.filter((line) => !after.lines.some((next) => next.productId === line.productId));
  const fewer = after.lines.filter((line) => (old.get(line.productId)?.quantity ?? 0) > line.quantity);

  if (after.itemCount === 0 && before.itemCount > 0) return "Your cart is now empty";
  if (added.length === 1 && removed.length === 0 && fewer.length === 0) {
    const line = added[0]!;
    return old.has(line.productId) ? `${line.name}: now ${line.quantity}` : `${line.name} added`;
  }
  if (removed.length === 1 && added.length === 0 && fewer.length === 0) return `${removed[0]!.name} removed`;
  if (fewer.length === 1 && added.length === 0 && removed.length === 0) return `${fewer[0]!.name}: now ${fewer[0]!.quantity}`;
  return "Your cart changed";
}

/** Everything below belongs to one session; `key` says which, so a previous shopper's cart is never shown. */
type Keyed<T> = { key: string | null } & T;

export function CartProvider({ children }: { children: ReactNode }) {
  const { status, token, rememberGuestCart } = useSession();
  const sessionKey = status === "loading" ? null : `${status}:${token ?? ""}`;

  const [store, setStore] = useState<Keyed<{ cart: Cart | null; error: string | null }>>({ key: null, cart: null, error: null });
  const [liveState, setLiveState] = useState<Keyed<{ value: LiveStatus }>>({ key: null, value: "connecting" });
  const [remote, setRemote] = useState<Keyed<{ change: RemoteChange | null }>>({ key: null, change: null });
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const keyRef = useRef<string | null>(null);
  const cartRef = useRef<Cart | null>(null);
  /** Changes this app is making right now: their echo on the live feed isn't news. */
  const ownChanges = useRef(0);
  const changeId = useRef(0);

  /**
   * Takes a cart from the server, for the session it was asked for. Answers to
   * our own changes (or a slow first load) can arrive after the live feed has
   * delivered something newer, so older versions are ignored, except from the
   * feed itself, which is always current.
   */
  const accept = useCallback((key: string | null, next: Cart, source: "feed" | "change" | "load") => {
    if (key === null || key !== keyRef.current) return;
    const previous = cartRef.current;
    if (source !== "feed" && previous && next.version < previous.version) return;
    cartRef.current = next;
    setStore({ key, cart: next, error: null });
    if (source !== "feed" || !previous || previous.version === next.version) return;
    if (next.changedVia === "app" && ownChanges.current > 0) return;
    changeId.current += 1;
    const change: RemoteChange = {
      id: changeId.current,
      where: next.changedVia === "web" ? "website" : "another device",
      text: describeChange(previous, next),
    };
    setRemote({ key, change });
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  }, []);

  // A different shopper (or none) starts from the server's copy.
  useEffect(() => {
    keyRef.current = sessionKey;
    cartRef.current = null;
    if (sessionKey === null) return;
    let active = true;
    api.cart().then(
      ({ cart }) => {
        if (active) accept(sessionKey, cart, "load");
      },
      (error: unknown) => {
        if (!active || (error instanceof ApiError && error.signedOut)) return;
        setStore({ key: sessionKey, cart: null, error: errorMessage(error, "Couldn't load your cart.") });
      },
    );
    return () => {
      active = false;
    };
  }, [sessionKey, accept]);

  // The live feed, while signed in and while the app is on screen.
  useEffect(() => {
    if (status !== "signedIn" || sessionKey === null) return;
    const key = sessionKey;
    let stopped = false;
    let request: AbortController | null = null;
    let wake: (() => void) | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          wake = null;
          resolve();
        }, ms);
        wake = () => {
          clearTimeout(timer);
          wake = null;
          resolve();
        };
      });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") wake?.();
      else request?.abort(); // let the waiting request go; ask again on return
    });

    void (async () => {
      let failures = 0;
      while (!stopped) {
        if (AppState.currentState !== "active") {
          await sleep(5 * 60_000);
          continue;
        }
        request = new AbortController();
        try {
          const answer = await api.cartChanges(cartRef.current?.version ?? null, request.signal);
          if (stopped) break;
          failures = 0;
          setLiveState({ key, value: "live" });
          if (answer.changed) accept(key, answer.cart, "feed");
        } catch (error) {
          if (stopped || isAbort(error)) continue;
          if (error instanceof ApiError && error.signedOut) break;
          failures += 1;
          setLiveState({ key, value: "offline" });
          await sleep(Math.min(30_000, 1_000 * 2 ** failures));
        }
      }
    })();

    return () => {
      stopped = true;
      request?.abort();
      wake?.();
      subscription.remove();
    };
  }, [status, sessionKey, accept]);

  const reload = useCallback(async () => {
    const key = keyRef.current;
    try {
      const { cart } = await api.cart();
      accept(key, cart, "load");
    } catch (error) {
      if (key === keyRef.current && !(error instanceof ApiError && error.signedOut)) {
        setStore((previous) => ({ ...previous, key, error: errorMessage(error, "Couldn't load your cart.") }));
      }
    }
  }, [accept]);

  /**
   * Runs a change this app makes, then takes the cart the server answers with.
   * Its echo on the live feed is never announced: if the feed gets there first,
   * the change is still in flight here; if the answer gets there first, the
   * feed brings a version the app already has.
   */
  const ownChange = useCallback(
    async <T extends { cart: Cart }>(work: () => Promise<T>): Promise<T> => {
      const key = keyRef.current;
      ownChanges.current += 1;
      try {
        const result = await work();
        accept(key, result.cart, "change");
        return result;
      } finally {
        ownChanges.current -= 1;
      }
    },
    [accept],
  );

  const placeOrder = useCallback(
    async (values: Record<CheckoutField, string>) => ownChange(() => api.placeOrder(values)),
    [ownChange],
  );

  const change = useCallback(
    async (productId: string, run: () => Promise<CartChangeResponse>, haptic: boolean) => {
      setPending((current) => new Set(current).add(productId));
      try {
        const result = await ownChange(run);
        if (result.guestCartId) await rememberGuestCart(result.guestCartId);
        if (haptic && result.ok && Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return { ok: result.ok, message: result.message };
      } catch (error) {
        return { ok: false, message: errorMessage(error, "Couldn't update your cart. Try again.") };
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
      }
    },
    [ownChange, rememberGuestCart],
  );

  const dismissRemoteChange = useCallback(() => setRemote({ key: null, change: null }), []);

  const current = store.key === sessionKey ? store : { cart: null, error: null };
  const live: LiveStatus = status !== "signedIn" ? "off" : liveState.key === sessionKey ? liveState.value : "connecting";
  const remoteChange = remote.key === sessionKey ? remote.change : null;

  const value = useMemo<CartValue>(
    () => ({
      cart: current.cart,
      loading: sessionKey === null || (current.cart === null && current.error === null),
      error: current.error,
      live,
      remoteChange,
      pending,
      reload,
      add: (productId, quantity) => change(productId, () => api.addToCart(productId, quantity), true),
      setQuantity: (productId, quantity) => change(productId, () => api.setQuantity(productId, quantity), false),
      remove: (productId) => change(productId, () => api.removeFromCart(productId), false),
      placeOrder,
      dismissRemoteChange,
    }),
    [current.cart, current.error, sessionKey, live, remoteChange, pending, reload, change, placeOrder, dismissRemoteChange],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
