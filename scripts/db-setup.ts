/**
 * Creates the tables and loads the sample catalog.
 *
 *   npm run db:setup              tables + sample products
 *   npm run db:setup -- --no-seed tables only
 *
 * Reads DATABASE_URL from the environment or from .env.local / .env.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { connectionSettings } from "../src/lib/db-url";

async function main() {
  const root = process.cwd();
  loadEnvConfig(root);

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    process.exitCode = 1;
    return;
  }

  const withSeed = !process.argv.includes("--no-seed");
  const { url, ssl } = connectionSettings(raw);
  const sql = postgres(url, {
    ...(ssl === undefined ? {} : { ssl }),
    max: 1,
    prepare: false,
    connect_timeout: 20,
    onnotice: () => {},
  });

  try {
    const host = new URL(url).hostname;
    console.log(`Connecting to ${host} ...`);

    const schema = await readFile(path.join(root, "db", "schema.sql"), "utf8");
    await sql.unsafe(schema).simple();
    console.log("✓ Tables are ready");

    if (withSeed) {
      const seed = await readFile(path.join(root, "db", "seed.sql"), "utf8");
      await sql.unsafe(seed).simple();
      console.log("✓ Sample products loaded");
    }

    const [row] = await sql<{ count: number }[]>`select count(*)::int as count from products`;
    console.log(`  ${row?.count ?? 0} products in the catalog`);
  } catch (error) {
    console.error("Database setup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
