import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/ile_aro_test";

const root = path.resolve(__dirname, "../../..");
const schemaSql = readFileSync(path.join(root, "db/schema.sql"), "utf8");
const seedSql = readFileSync(path.join(root, "db/seed.sql"), "utf8");

/** Direct database access for setting up and checking test state. */
export const sql = postgres(TEST_DATABASE_URL, {
  max: 2,
  idle_timeout: 2,
  prepare: false,
  transform: postgres.camel,
  onnotice: () => {},
});

/** Creates the test database if it doesn't exist yet. */
export async function ensureDatabase(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = "/postgres";
  const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }
}

/** Every test starts from a fresh schema and the sample catalog. */
export async function resetDatabase(): Promise<void> {
  await sql.unsafe("drop schema if exists public cascade; create schema public;").simple();
  await sql.unsafe(schemaSql).simple();
  await sql.unsafe(seedSql).simple();
}

export async function productBySlug(slug: string) {
  const [row] = await sql<{ id: string; stock: number; priceKobo: number; name: string }[]>`
    select id, stock, price_kobo, name from products where slug = ${slug}`;
  if (!row) throw new Error(`No product ${slug}`);
  return row;
}

export async function setStock(slug: string, stock: number): Promise<void> {
  await sql`update products set stock = ${stock} where slug = ${slug}`;
}

export async function userByEmail(email: string) {
  const [row] = await sql<{ id: string; name: string | null; googleSub: string }[]>`
    select id, name, google_sub from users where email = ${email}`;
  return row ?? null;
}

export async function ordersFor(email: string) {
  return sql<
    {
      id: string;
      reference: string;
      status: string;
      paymentMethod: string;
      paymentStatus: string;
      subtotalKobo: number;
      deliveryKobo: number;
      totalKobo: number;
      phone: string;
      state: string;
      confirmationEmailSentAt: Date | null;
    }[]
  >`select id, reference, status, payment_method, payment_status, subtotal_kobo, delivery_kobo, total_kobo,
           phone, state, confirmation_email_sent_at
    from orders where email = ${email} order by created_at`;
}
