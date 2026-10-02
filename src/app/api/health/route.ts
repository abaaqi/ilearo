import { db } from "@/lib/db";

/**
 * GET /api/health: answers 200 when the app can reach the database.
 * Handy right after deploying to check the DATABASE_URL is right.
 */
export async function GET() {
  try {
    const sql = db();
    const [row] = await sql<{ products: number }[]>`select count(*)::int as products from products`;
    return Response.json({ ok: true, database: "reachable", products: row?.products ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const hint = /relation "products" does not exist/.test(message)
      ? "The database is reachable but has no tables yet. Run: npm run db:setup"
      : "Check DATABASE_URL.";
    console.error("[health]", message);
    return Response.json({ ok: false, database: "unreachable", hint }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
