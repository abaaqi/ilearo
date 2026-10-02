import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import {
  GOOGLE_PROVIDER,
  SignInError,
  buildAuthorizationUrl,
  constantTimeEqual,
  decodePendingSignIn,
  encodePendingSignIn,
  pkceChallenge,
  randomToken,
  safeReturnTo,
  verifyIdToken,
  type OidcProvider,
} from "@/lib/auth/oidc";

describe("safeReturnTo", () => {
  it.each([
    ["/checkout", "/checkout"],
    ["/orders/IA-7K3M9Q?placed=1#pay", "/orders/IA-7K3M9Q?placed=1#pay"],
    ["/shop?category=cloth", "/shop?category=cloth"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected);
  });

  it.each([
    "//evil.example",
    "https://evil.example/checkout",
    "/\\evil.example",
    "javascript:alert(1)",
    "checkout",
    "/api/auth/google",
    "/api/auth/google/callback?code=1",
    "/ok\nSet-Cookie: x=1",
    "",
    "/" + "a".repeat(600),
  ])("refuses %j", (input) => {
    expect(safeReturnTo(input)).toBe("/");
  });

  it("uses the fallback for non-strings", () => {
    expect(safeReturnTo(undefined, "/account")).toBe("/account");
    expect(safeReturnTo(["/checkout"], "/account")).toBe("/account");
  });
});

describe("PKCE and random values", () => {
  it("matches the RFC 7636 example", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("makes URL-safe random tokens", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(token);
  });

  it("compares strings without short-circuiting", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});

describe("pending sign-in cookie", () => {
  it("round-trips", () => {
    const pending = { state: "s", nonce: "n", verifier: "v", returnTo: "/checkout" };
    expect(decodePendingSignIn(encodePendingSignIn(pending))).toEqual(pending);
  });

  it("re-checks the return path when reading it back", () => {
    const raw = encodePendingSignIn({ state: "s", nonce: "n", verifier: "v", returnTo: "//evil.example" });
    expect(decodePendingSignIn(raw)?.returnTo).toBe("/");
  });

  it.each([undefined, "", "not-base64-json", Buffer.from('{"state":1}').toString("base64url")])("rejects %j", (raw) => {
    expect(decodePendingSignIn(raw)).toBeNull();
  });
});

describe("authorization URL", () => {
  it("asks Google for an OpenID code with PKCE", () => {
    const url = new URL(
      buildAuthorizationUrl(GOOGLE_PROVIDER, {
        clientId: "id.apps.googleusercontent.com",
        redirectUri: "https://shop.example/api/auth/google/callback",
        state: "st",
        nonce: "no",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "id.apps.googleusercontent.com",
      redirect_uri: "https://shop.example/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      nonce: "no",
      code_challenge: "ch",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });
});

describe("verifyIdToken", () => {
  const CLIENT_ID = "shop.apps.googleusercontent.com";
  const provider: OidcProvider = GOOGLE_PROVIDER;
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  let keys: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair("RS256")).privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
    keys = createLocalJWKSet({ keys: [jwk] });
  });

  const sign = (
    claims: Record<string, unknown> = {},
    options: { issuer?: string; audience?: string; expires?: number | string; key?: CryptoKey } = {},
  ) =>
    new SignJWT({ email: "ada@example.com", email_verified: true, name: "Ada Obi", nonce: "nonce-1", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(options.issuer ?? "https://accounts.google.com")
      .setAudience(options.audience ?? CLIENT_ID)
      .setSubject("1234567890")
      .setIssuedAt()
      .setExpirationTime(options.expires ?? "1h")
      .sign(options.key ?? privateKey);

  const verify = (token: string, nonce = "nonce-1") => verifyIdToken(token, { provider, clientId: CLIENT_ID, nonce, keys });

  it("returns the profile from a valid token", async () => {
    expect(await verify(await sign({ picture: "https://lh3.googleusercontent.com/a/x" }))).toEqual({
      sub: "1234567890",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada Obi",
      picture: "https://lh3.googleusercontent.com/a/x",
    });
  });

  it("accepts Google's legacy issuer spelling", async () => {
    await expect(verify(await sign({}, { issuer: "accounts.google.com" }))).resolves.toMatchObject({ sub: "1234567890" });
  });

  it("reports unverified emails without throwing", async () => {
    expect((await verify(await sign({ email_verified: false }))).emailVerified).toBe(false);
  });

  const rejects = async (token: Promise<string>, code: SignInError["code"], nonce?: string) => {
    const error = await verify(await token, nonce).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SignInError);
    expect((error as SignInError).code).toBe(code);
  };

  it("rejects a token for another app", () => rejects(sign({}, { audience: "other.apps.googleusercontent.com" }), "id_token"));
  it("rejects a token from another issuer", () => rejects(sign({}, { issuer: "https://evil.example" }), "id_token"));
  it("rejects an expired token", () => rejects(sign({}, { expires: Math.floor(Date.now() / 1000) - 600 }), "id_token"));
  it("rejects a token signed with someone else's key", () => rejects(sign({}, { key: otherKey }), "id_token"));
  it("rejects a replayed token (wrong nonce)", () => rejects(sign(), "nonce", "a-different-nonce"));
  it("rejects a token authorised for another client", () => rejects(sign({ azp: "other-client" }), "id_token"));
  it("rejects a token without an email", () => rejects(sign({ email: undefined }), "profile"));

  it("rejects unsigned tokens", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({ iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "1", email: "x@y.z", nonce: "nonce-1", iat: now, exp: now + 60 }),
    ).toString("base64url");
    await rejects(Promise.resolve(`${header}.${body}.`), "id_token");
  });
});
