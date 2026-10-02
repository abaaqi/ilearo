/**
 * Helpers for turning a Supabase / Neon connection string into options for
 * postgres.js. Kept free of server-only imports so the setup script and unit
 * tests can use them too.
 */

// postgres.js forwards unknown query parameters to Postgres as startup
// settings, and Postgres refuses settings it doesn't recognise. Hosted
// providers add client-side options to their URLs (Neon's channel_binding,
// Prisma's pgbouncer=true, connection_limit, ...), so only these survive.
const PASS_THROUGH = new Set([
  "sslmode",
  "ssl",
  "sslrootcert",
  "sslnegotiation",
  "options",
  "application_name",
  "target_session_attrs",
  "search_path",
]);

export function sanitizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (!PASS_THROUGH.has(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

export function isLocalDatabase(raw: string): boolean {
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export type ConnectionSettings = {
  url: string;
  /** undefined means "let the sslmode in the URL decide". */
  ssl: false | "require" | undefined;
};

/**
 * Hosted databases need TLS. "require" encrypts the connection without
 * checking the certificate chain (the same as libpq's sslmode=require), which
 * works with Supabase's own CA as well as Neon's public certificates. Put
 * sslmode=verify-full in the URL if you want full verification.
 */
export function connectionSettings(raw: string): ConnectionSettings {
  const parsed = new URL(raw);
  const explicit = parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl");
  return {
    url: sanitizeDatabaseUrl(raw),
    ssl: explicit ? undefined : isLocalDatabase(raw) ? false : "require",
  };
}
