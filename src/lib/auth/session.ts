import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { usesHttps } from "../env";
import { randomToken } from "./oidc";

/**
 * Two kinds of session, one account:
 *
 *   web  the website's cookie (30 days)
 *   app  a bearer token the mobile app keeps in the phone's secure storage
 *        (90 days, renewed while the app is in use)
 *
 * Both point at the same users row, which is what makes the website and the
 * app one account. Each token only works where it was issued: a web cookie
 * can't be used as an app token, or the other way round.
 */
export type SessionClient = "web" | "app";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DAYS: Record<SessionClient, number> = { web: 30, app: 90 };
/** An app session is extended when it's used with fewer days than this left. */
const APP_RENEW_BELOW_DAYS = 60;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/** The __Host- prefix makes browsers refuse any copy not set by this exact origin over HTTPS. */
export function sessionCookieName(): string {
  return usesHttps() ? "__Host-ia_session" : "ia_session";
}

/** Only this hash is stored, so a database leak can't be replayed. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

export function sessionCookie(token: string, expires: Date) {
  return {
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    secure: usesHttps(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(
  userId: string,
  userAgent: string | null,
  client: SessionClient = "web",
): Promise<{ token: string; expires: Date }> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS[client] * DAY_MS);
  const sql = db();
  await sql`
    insert into sessions (id, user_id, expires_at, user_agent, client)
    values (${await hashToken(token)}, ${userId}, ${expires}, ${userAgent ? userAgent.slice(0, 300) : null}, ${client})
  `;
  // Housekeeping: drop sessions that ran out more than a day ago.
  await sql`delete from sessions where expires_at < now() - interval '1 day'`;
  return { token, expires };
}

/** Tokens are 43 base64url characters; anything far off that is rejected without a query. */
const plausibleToken = (token: string) => token.length >= 16 && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token);

async function findSession(token: string, client: SessionClient) {
  if (!plausibleToken(token)) return null;
  const sql = db();
  const id = await hashToken(token);
  const [row] = await sql<(SessionUser & { expiresAt: Date })[]>`
    select u.id, u.email, u.name, u.avatar_url, s.expires_at
    from sessions s
    join users u on u.id = s.user_id
    where s.id = ${id} and s.client = ${client} and s.expires_at > now()
  `;
  if (!row) return null;
  const { expiresAt, ...user } = row;
  return { id, user, expiresAt };
}

/** The signed-in shopper for this website request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  return (await findSession(token, "web"))?.user ?? null;
});

/** The shopper an app token belongs to, or null. Keeps the session alive while the app is in use. */
export async function userForAppToken(token: string): Promise<SessionUser | null> {
  const session = await findSession(token, "app");
  if (!session) return null;
  if (session.expiresAt.getTime() - Date.now() < APP_RENEW_BELOW_DAYS * DAY_MS) {
    const sql = db();
    await sql`update sessions set expires_at = ${new Date(Date.now() + SESSION_DAYS.app * DAY_MS)} where id = ${session.id}`;
  }
  return session.user;
}

/** Signs one app install out. */
export async function endAppSession(token: string): Promise<void> {
  if (!plausibleToken(token)) return;
  const sql = db();
  await sql`delete from sessions where id = ${await hashToken(token)} and client = 'app'`;
}

/** How many phones are signed in to this account through the app. */
export async function appSessionCount(userId: string): Promise<number> {
  const sql = db();
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from sessions where user_id = ${userId} and client = 'app' and expires_at > now()
  `;
  return row?.n ?? 0;
}

/** Sends signed-out visitors to sign in, then back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Deletes the session row and the cookie. Call from a Server Action. */
export async function endCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  if (token && plausibleToken(token)) {
    const sql = db();
    await sql`delete from sessions where id = ${await hashToken(token)} and client = 'web'`;
  }
  store.set({ ...sessionCookie("", new Date(0)), maxAge: 0 });
}
