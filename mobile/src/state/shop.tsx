import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "@/lib/api";
import type { ShopInfo } from "@/lib/types";

/** The shop's categories, delivery zones and ways to pay, from /api/v1/shop. Loaded once. */
type ShopValue = { shop: ShopInfo | null; error: string | null; retry: () => void };

const ShopContext = createContext<ShopValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .shop()
      .then(({ shop: info }) => {
        if (!cancelled) {
          setShop(info);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Can't reach the shop.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return <ShopContext value={{ shop, error, retry }}>{children}</ShopContext>;
}

export function useShop(): ShopValue {
  const value = use(ShopContext);
  if (!value) throw new Error("useShop must be used inside <ShopProvider>");
  return value;
}
