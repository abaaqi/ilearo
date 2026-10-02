import { ensureDatabase, resetDatabase, sql } from "./support/db";

export default async function globalSetup() {
  await ensureDatabase();
  await resetDatabase();
  await sql.end();
}
