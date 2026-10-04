/**
 * Helpers for turning a Supabase / Neon connection string into options for
 * postgres.js. Kept free of server-only imports so the setup script and unit
 * tests can use them too.
 */
import { cleanEnvValue } from "./env-value";

/** DATABASE_URL is missing or can't be read; the message says how to fix it. */
export class DatabaseConfigError extends Error {
  constructor(
    readonly reason: "missing" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

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

/**
 * Reads a DATABASE_URL value (quotes and spaces around it are ignored) and
 * returns connection settings, or throws a DatabaseConfigError that says
 * what to change.
 */
export function databaseSettings(value: string | undefined): ConnectionSettings {
  const raw = cleanEnvValue(value);
  if (!raw) {
    throw new DatabaseConfigError(
      "missing",
      "DATABASE_URL is not set. Add your Supabase or Neon connection string to .env.local, or to your host's environment variables, then restart or redeploy.",
    );
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    // handled below
  }
  if (!parsed || (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") || !parsed.hostname) {
    throw new DatabaseConfigError(
      "invalid",
      "DATABASE_URL isn't a valid Postgres connection string. Use only the string that starts with postgresql:// (no quotes, nothing in front), and URL-encode special characters in the password: # as %23, / as %2F, ? as %3F, @ as %40.",
    );
  }
  return connectionSettings(raw);
}
