import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { explainDatabaseError } from "@/lib/db-diagnostics";
import { appUrl, bankDetails, googleSettings, mailgunSettings, supportEmail } from "@/lib/env";

/**
 * GET /api/health: a setup checker. Answers 200 when the database works, and
 * says in plain words what is missing or wrong. It shows whether each setting
 * is present, never the secret values themselves.
 */
export async function GET(request: NextRequest) {
  const toFix: string[] = [];

  let database: string;
  let databaseOk = false;
  try {
    const sql = db();
    const [row] = await sql<{ products: number }[]>`select count(*)::int as products from products`;
    databaseOk = true;
    database = `reachable (${row?.products ?? 0} products)`;
  } catch (error) {
    const diagnosis = explainDatabaseError(error);
    console.error(`[health] ${diagnosis.problem}${diagnosis.code ? ` (${diagnosis.code})` : ""}:`, error);
    database = diagnosis.problem;
    toFix.push(diagnosis.fix);
  }

  const configured = appUrl();
  const site = siteOrigin(request);
  let appUrlStatus = configured;
  let configuredOrigin: string | null = null;
  try {
    configuredOrigin = new URL(configured).origin;
  } catch {
    toFix.push(`APP_URL must be a full address starting with https://, such as ${site ?? "https://your-site.netlify.app"}.`);
  }
  if (configuredOrigin && site && configuredOrigin !== site) {
    appUrlStatus = `${configured}, but this site is ${site}`;
    toFix.push(`Set APP_URL to ${site} (no trailing slash) and redeploy. Google sign-in and the links in emails use it.`);
  } else if (configuredOrigin) {
    appUrlStatus = `${configured} (matches this site)`;
  }

  const google = googleSettings();
  if (!google) toFix.push("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET so customers can sign in to check out.");

  const contact = supportEmail();
  if (!contact) toFix.push("Set SHOP_SUPPORT_EMAIL to the address customers should write to.");

  return Response.json(
    {
      ok: databaseOk,
      database,
      appUrl: appUrlStatus,
      googleSignIn: google ? `configured; Google's redirect URI list must include ${google.redirectUri}` : "not configured",
      email: mailgunSettings() ? "configured" : "not configured (confirmation emails are written to the server log instead)",
      bankTransfer: bankDetails() ? "offered" : "not offered",
      contactEmail: contact ? "set" : "not set (no contact address in the footer or on emails)",
      ...(toFix.length > 0 ? { toFix } : {}),
    },
    { status: databaseOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** The address the visitor used, as seen behind Netlify's or Vercel's proxy. */
function siteOrigin(request: NextRequest): string | null {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim();
  if (!host) return null;
  const proto = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).split(",")[0]?.trim();
  return `${proto || "https"}://${host}`;
}
