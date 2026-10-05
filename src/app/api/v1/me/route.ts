import { apiCaller, apiJson, apiRoute, apiUser, requireUser } from "@/lib/api";

/** GET /api/v1/me: the signed-in shopper. 401 when signed out. */
export const GET = apiRoute(async (request) => {
  const user = requireUser(await apiCaller(request, { cookies: true }));
  return apiJson({ user: apiUser(user) });
});
