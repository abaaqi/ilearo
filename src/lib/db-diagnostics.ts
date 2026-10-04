/**
 * Turns a database error into a plain explanation and a fix, for the setup
 * checker at /api/health and the server log. Never includes the connection
 * string or the raw error message, which can contain user names and hosts.
 */
import { DatabaseConfigError } from "./db-url";

export type DatabaseDiagnosis = {
  problem: string;
  fix: string;
  /** Node or Postgres error code, when there is one. */
  code?: string;
};

const USE_POOLER =
  "If you use Supabase, copy the Transaction pooler string (port 6543) from the Connect dialog: the direct connection only works over IPv6, which Netlify and Vercel servers don't have.";

export function explainDatabaseError(error: unknown): DatabaseDiagnosis {
  if (error instanceof DatabaseConfigError) {
    return error.reason === "missing"
      ? {
          problem: "DATABASE_URL is not set",
          fix: "Add DATABASE_URL to your host's environment variables (on Netlify: Site or Project configuration → Environment variables, with all scopes), then trigger a new deploy. Hosts only apply changed variables on a new deploy.",
        }
      : {
          problem: "DATABASE_URL isn't a valid connection string",
          fix: "Paste only the string that starts with postgresql://, without quotes or DATABASE_URL= in front. URL-encode special characters in the password: # as %23, / as %2F, ? as %3F, @ as %40.",
        };
  }

  const details = (error && typeof error === "object" ? error : {}) as { code?: unknown; message?: unknown };
  const code = typeof details.code === "string" ? details.code : undefined;
  const message = typeof details.message === "string" ? details.message : "";

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return { code, problem: "The database server's address can't be found", fix: "Check DATABASE_URL was copied completely, including everything after the @." };
    case "ENETUNREACH":
    case "EHOSTUNREACH":
    case "EADDRNOTAVAIL":
      return { code, problem: "The database server can't be reached from this server", fix: USE_POOLER };
    case "ETIMEDOUT":
    case "CONNECT_TIMEOUT":
      return {
        code,
        problem: "Connecting to the database timed out",
        fix: `${USE_POOLER} Free Supabase projects also pause after a week without use; restore it from the Supabase dashboard.`,
      };
    case "ECONNREFUSED":
      return { code, problem: "The database server refused the connection", fix: "Check the port in DATABASE_URL (Supabase's pooler uses 6543) and that the database is running." };
    case "28P01":
    case "28000":
      return {
        code,
        problem: "The database rejected the username or password",
        fix: "Copy the connection string again and check the password. If unsure, reset it in your provider's database settings, and URL-encode any special characters.",
      };
    case "3D000":
      return { code, problem: "The database named in DATABASE_URL doesn't exist", fix: "Use the database name from your provider's connection string (Supabase: postgres, Neon: neondb)." };
    case "42P01":
      return {
        code,
        problem: "Connected, but the shop's tables don't exist yet",
        fix: "Run npm run db:setup with this DATABASE_URL, or paste db/schema.sql and then db/seed.sql into your provider's SQL editor.",
      };
    case "53300":
      return {
        code,
        problem: "The database has run out of connections",
        fix: "Use the pooled connection string (Supabase's Transaction pooler or Neon's -pooler host), or set DATABASE_POOL_MAX lower.",
      };
  }

  if (/tenant or user not found/i.test(message)) {
    return {
      code,
      problem: "Supabase's pooler doesn't recognise the user",
      fix: "With the pooler, the user name must be postgres.<project-ref>, exactly as shown in Supabase's Connect dialog.",
    };
  }
  if (/\bssl\b|certificate|self[- ]signed/i.test(message)) {
    return { code, problem: "The secure (TLS) connection to the database failed", fix: "Add ?sslmode=require to the end of DATABASE_URL." };
  }
  return { code, problem: "The database couldn't be used", fix: "Check the server log (on Netlify: Logs → Functions) for the full error." };
}
