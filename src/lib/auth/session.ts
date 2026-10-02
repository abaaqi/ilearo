import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { usesHttps } from "../env";
import { randomToken } from "./oidc";

const SESSION_DAYS = 30;

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

async function hashToken(token: string): Promise<string> {
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

export async function createSession(userId: string, userAgent: string | null): Promise<{ token: string; expires: Date }> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = db();
  await sql`
    insert into sessions (id, user_id, expires_at, user_agent)
    values (${await hashToken(token)}, ${userId}, ${expires}, ${userAgent ? userAgent.slice(0, 300) : null})
  `;
  // Housekeeping: drop sessions that ran out more than a day ago.
  await sql`delete from sessions where expires_at < now() - interval '1 day'`;
  return { token, expires };
}

/** The signed-in shopper for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token || token.length > 128) return null;
  const sql = db();
  const [user] = await sql<SessionUser[]>`
    select u.id, u.email, u.name, u.avatar_url
    from sessions s
    join users u on u.id = s.user_id
    where s.id = ${await hashToken(token)} and s.expires_at > now()
  `;
  return user ?? null;
});

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
  if (token) {
    const sql = db();
    await sql`delete from sessions where id = ${await hashToken(token)}`;
  }
  store.set({ ...sessionCookie("", new Date(0)), maxAge: 0 });
}
