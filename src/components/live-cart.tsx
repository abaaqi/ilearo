"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

/**
 * Keeps a signed-in shopper's website in step with the mobile app.
 *
 * Listens to the same live cart feed the app uses (/api/v1/cart/changes) and
 * refreshes the page when the cart changes somewhere else: the app on their
 * phone, or another tab. It only listens while the tab is visible.
 */
export function LiveCart({ version }: { version: number }) {
  const router = useRouter();
  const known = useRef(version);

  useEffect(() => {
    // The page itself brought a newer version (after a change made on this page).
    known.current = Math.max(known.current, version);
  }, [version]);

  useEffect(() => {
    let stopped = false;
    let request: AbortController | null = null;
    let wake: (() => void) | null = null;

    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") wake?.();
      else request?.abort();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    void (async () => {
      let failures = 0;
      while (!stopped) {
        if (document.visibilityState !== "visible") {
          await pause(60_000);
          continue;
        }
        request = new AbortController();
        try {
          const response = await fetch(`/api/v1/cart/changes?after=${known.current}`, {
            cache: "no-store",
            signal: request.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error(`The live cart answered ${response.status}`);
          const body = (await response.json()) as { changed: boolean; cart?: { version: number } };
          failures = 0;
          if (body.changed && body.cart && body.cart.version !== known.current) {
            known.current = body.cart.version;
            startTransition(() => router.refresh());
          }
        } catch {
          if (stopped || document.visibilityState !== "visible") continue;
          // Offline or the server is struggling: back off, up to 30 seconds.
          failures += 1;
          await pause(Math.min(30_000, 1_000 * 2 ** failures));
        }
      }
    })();

    return () => {
      stopped = true;
      request?.abort();
      wake?.();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
