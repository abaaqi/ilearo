import { apiJson, apiRoute } from "@/lib/api";
import { endAppSession } from "@/lib/auth/session";

/** POST /api/v1/auth/sign-out with the app's bearer token: ends that app session. Signing out twice is fine. */
export const POST = apiRoute(async (request) => {
  const token = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (token) await endAppSession(token);
  return apiJson({ ok: true });
});
