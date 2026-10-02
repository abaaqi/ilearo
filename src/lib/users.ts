import "server-only";
import { db } from "./db";
import type { GoogleProfile } from "./auth/oidc";

/** Creates the user on first sign-in, refreshes name/email/photo after that. */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<string> {
  const sql = db();
  const [row] = await sql<{ id: string }[]>`
    insert into users (google_sub, email, email_verified, name, avatar_url, last_login_at)
    values (${profile.sub}, ${profile.email}, ${profile.emailVerified}, ${profile.name}, ${profile.picture}, now())
    on conflict (google_sub) do update set
      email          = excluded.email,
      email_verified = excluded.email_verified,
      name           = excluded.name,
      avatar_url     = excluded.avatar_url,
      last_login_at  = now(),
      updated_at     = now()
    returning id
  `;
  if (!row) throw new Error("Could not save the user");
  return row.id;
}
