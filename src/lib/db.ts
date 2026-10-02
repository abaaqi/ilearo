import "server-only";
import postgres from "postgres";
import { connectionSettings } from "./db-url";

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

const globalForDb = globalThis as typeof globalThis & { __ileAroSql?: Sql };

/**
 * The shared Postgres client. Created on first use so `next build` never
 * needs a database.
 *
 * - `prepare: false` keeps it compatible with transaction-mode poolers
 *   (Supabase's port 6543, Neon's "-pooler" host, PgBouncer).
 * - `transform: postgres.camel` maps snake_case columns to camelCase fields.
 */
export function db(): Sql {
  if (globalForDb.__ileAroSql) return globalForDb.__ileAroSql;

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase or Neon connection string to .env.local (see .env.example).",
    );
  }

  const { url, ssl } = connectionSettings(raw);
  const client = postgres(url, {
    ...(ssl === undefined ? {} : { ssl }),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    transform: postgres.camel,
    onnotice: () => {},
  });

  globalForDb.__ileAroSql = client;
  return client;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
