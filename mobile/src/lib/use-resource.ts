import { useEffect, useEffectEvent, useState } from "react";
import { ApiError } from "./api";

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

type Result<T> = { key: string | null; data: T | null; error: string | null };

/**
 * Loads something from the shop for `key` (null means there's nothing to
 * load yet) and keeps it until the key changes. Data from an old key is never
 * shown for a new one.
 *
 *   retry()    asks again (for "Try again" buttons)
 *   refresh()  asks again and resolves when done (for pull-to-refresh)
 */
export function useResource<T>(key: string | null, load: () => Promise<T>, fallbackError: string) {
  const [result, setResult] = useState<Result<T>>({ key: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const loadNow = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    loadNow().then(
      (data) => {
        if (active) setResult({ key, data, error: null });
      },
      (error: unknown) => {
        if (!active) return;
        setResult((previous) => ({
          key,
          data: previous.key === key ? previous.data : null,
          error: errorMessage(error, fallbackError),
        }));
      },
    );
    return () => {
      active = false;
    };
  }, [key, attempt, fallbackError]);

  const current = result.key === key ? result : { key, data: null, error: null };

  return {
    data: current.data,
    error: current.error,
    retry: () => {
      setResult((previous) => ({ ...previous, error: null }));
      setAttempt((n) => n + 1);
    },
    refresh: async () => {
      try {
        const data = await load();
        setResult({ key, data, error: null });
      } catch (error) {
        setResult((previous) => ({
          key,
          data: previous.key === key ? previous.data : null,
          error: errorMessage(error, fallbackError),
        }));
      }
    },
  };
}
