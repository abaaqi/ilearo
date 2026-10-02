/**
 * Stand-ins for Google's OpenID Connect endpoints and Mailgun's send API,
 * used by the end-to-end tests. The app talks to them exactly as it talks
 * to the real services; only the base URLs differ.
 *
 *   GET  /authorize            account chooser (like Google's)
 *   POST /token                code + PKCE verifier → signed ID token
 *   GET  /jwks                 public key for verifying ID tokens
 *   POST /v3/:domain/messages  Mailgun send
 *   /__test/*                  inspection and fault injection for tests
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const ISSUER = `http://localhost:${PORT}`;
const CLIENT_ID = process.env.MOCK_GOOGLE_CLIENT_ID ?? "test-client.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.MOCK_GOOGLE_CLIENT_SECRET ?? "test-secret";
const MAILGUN_KEY = process.env.MOCK_MAILGUN_KEY ?? "test-mailgun-key";

const ACCOUNTS = {
  amina: { sub: "110000000000000000001", email: "amina.bello@example.com", email_verified: true, name: "Amina Bello" },
  tunde: { sub: "110000000000000000002", email: "tunde.adeyemi@example.com", email_verified: true, name: "Tunde Adeyemi" },
  unverified: { sub: "110000000000000000003", email: "new.shopper@example.com", email_verified: false, name: "New Shopper" },
};

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "mock-key-1", alg: "RS256", use: "sig" };

let codes = new Map();
let emails = [];
let mailgunFailures = 0;
let nextTokenFault = null; // "wrong-audience" | "wrong-nonce" | "expired" | "wrong-issuer"

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const html = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mock Google</title></head><body style="font-family:sans-serif;max-width:32rem;margin:3rem auto">${body}</body></html>`);
};
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function idTokenFor(entry) {
  const fault = nextTokenFault;
  nextTokenFault = null;
  const account = ACCOUNTS[entry.account];
  const token = new SignJWT({
    email: account.email,
    email_verified: account.email_verified,
    name: account.name,
    nonce: fault === "wrong-nonce" ? "not-the-nonce" : entry.nonce,
    azp: CLIENT_ID,
  })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(fault === "wrong-issuer" ? "https://evil.example" : ISSUER)
    .setAudience(fault === "wrong-audience" ? "someone-else.apps.googleusercontent.com" : CLIENT_ID)
    .setSubject(account.sub)
    .setIssuedAt(fault === "expired" ? Math.floor(Date.now() / 1000) - 7200 : undefined)
    .setExpirationTime(fault === "expired" ? Math.floor(Date.now() / 1000) - 3600 : "1h");
  return token.sign(privateKey);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  try {
    /* ---------------- Google ---------------- */
    if (req.method === "GET" && url.pathname === "/authorize") {
      const p = url.searchParams;
      const problems = [];
      if (p.get("client_id") !== CLIENT_ID) problems.push("unknown client_id");
      if (p.get("response_type") !== "code") problems.push("response_type must be code");
      if (!p.get("scope")?.split(" ").includes("openid")) problems.push("scope must include openid");
      if (p.get("code_challenge_method") !== "S256" || !p.get("code_challenge")) problems.push("PKCE S256 required");
      if (!p.get("state") || !p.get("nonce")) problems.push("state and nonce required");
      if (!p.get("redirect_uri")) problems.push("redirect_uri required");
      if (problems.length) return html(res, 400, `<h1>Bad request</h1><p>${problems.map(escape).join("<br>")}</p>`);
      const links = Object.entries(ACCOUNTS)
        .map(([key, a]) => {
          const approve = new URL("/authorize/approve", ISSUER);
          for (const [k, v] of p) approve.searchParams.set(k, v);
          approve.searchParams.set("account", key);
          return `<li><a href="${escape(approve)}">${escape(a.name)}</a> <small>${escape(a.email)}</small></li>`;
        })
        .join("");
      const deny = new URL(p.get("redirect_uri"));
      deny.searchParams.set("error", "access_denied");
      deny.searchParams.set("state", p.get("state"));
      return html(res, 200, `<h1>Choose an account</h1><ul>${links}</ul><p><a href="${escape(deny)}">Cancel</a></p>`);
    }

    if (req.method === "GET" && url.pathname === "/authorize/approve") {
      const p = url.searchParams;
      const code = b64url(randomBytes(24));
      codes.set(code, {
        account: p.get("account"),
        nonce: p.get("nonce"),
        challenge: p.get("code_challenge"),
        redirectUri: p.get("redirect_uri"),
        used: false,
      });
      const back = new URL(p.get("redirect_uri"));
      back.searchParams.set("code", code);
      back.searchParams.set("state", p.get("state"));
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }

    if (req.method === "POST" && url.pathname === "/token") {
      const body = new URLSearchParams(await readBody(req));
      const entry = codes.get(body.get("code") ?? "");
      if (body.get("grant_type") !== "authorization_code") return json(res, 400, { error: "unsupported_grant_type" });
      if (body.get("client_id") !== CLIENT_ID || body.get("client_secret") !== CLIENT_SECRET) {
        return json(res, 401, { error: "invalid_client" });
      }
      if (!entry || entry.used) return json(res, 400, { error: "invalid_grant" });
      if (entry.redirectUri !== body.get("redirect_uri")) return json(res, 400, { error: "redirect_uri_mismatch" });
      const verifier = body.get("code_verifier") ?? "";
      if (b64url(createHash("sha256").update(verifier).digest()) !== entry.challenge) {
        return json(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed" });
      }
      entry.used = true;
      return json(res, 200, {
        access_token: b64url(randomBytes(24)),
        expires_in: 3599,
        token_type: "Bearer",
        scope: "openid email profile",
        id_token: await idTokenFor(entry),
      });
    }

    if (req.method === "GET" && url.pathname === "/jwks") return json(res, 200, { keys: [jwk] });

    /* ---------------- Mailgun ---------------- */
    const send = /^\/v3\/([^/]+)\/messages$/.exec(url.pathname);
    if (req.method === "POST" && send) {
      const expected = `Basic ${Buffer.from(`api:${MAILGUN_KEY}`).toString("base64")}`;
      if (req.headers.authorization !== expected) return json(res, 401, { message: "Invalid private key" });
      const body = new URLSearchParams(await readBody(req));
      if (mailgunFailures > 0) {
        mailgunFailures -= 1;
        return json(res, 500, { message: "Simulated outage" });
      }
      const id = `<${Date.now()}.${b64url(randomBytes(6))}@${decodeURIComponent(send[1])}>`;
      const variables = {};
      for (const [k, v] of body) if (k.startsWith("v:")) variables[k.slice(2)] = v;
      emails.push({
        id,
        domain: decodeURIComponent(send[1]),
        from: body.get("from"),
        to: body.get("to"),
        subject: body.get("subject"),
        text: body.get("text"),
        html: body.get("html"),
        replyTo: body.get("h:Reply-To"),
        tags: body.getAll("o:tag"),
        variables,
      });
      return json(res, 200, { id, message: "Queued. Thank you." });
    }

    /* ---------------- Test controls ---------------- */
    if (url.pathname === "/__test/health") return json(res, 200, { ok: true });
    if (url.pathname === "/__test/emails") return json(res, 200, emails);
    if (req.method === "POST" && url.pathname === "/__test/reset") {
      codes = new Map();
      emails = [];
      mailgunFailures = 0;
      nextTokenFault = null;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__test/mailgun-fail") {
      mailgunFailures = Number(url.searchParams.get("count") ?? 1);
      return json(res, 200, { ok: true, mailgunFailures });
    }
    if (req.method === "POST" && url.pathname === "/__test/token-fault") {
      nextTokenFault = url.searchParams.get("mode");
      return json(res, 200, { ok: true, nextTokenFault });
    }

    json(res, 404, { error: "not_found", path: url.pathname });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: String(error) });
  }
});

server.listen(PORT, () => console.log(`Mock Google + Mailgun on ${ISSUER}`));
