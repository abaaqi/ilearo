/**
 * The browser version of storage.ts, for running the app with `npx expo start --web`.
 * Browsers have no secure store, so this uses localStorage.
 */
function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

export const storage = {
  get: async (key: string) => safely(() => window.localStorage.getItem(key), null),
  set: async (key: string, value: string) => safely(() => window.localStorage.setItem(key, value), undefined),
  remove: async (key: string) => safely(() => window.localStorage.removeItem(key), undefined),
};
