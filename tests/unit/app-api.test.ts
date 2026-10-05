import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ART_VERSION, artPath, artSvg, parseArtFileName, svgMarkup } from "@/lib/art-svg";
import { PATTERNS, TONES, drawArt } from "@/components/adire/art";
import { appRedirectUrl, isAllowedAppRedirect, isCodeChallenge, isCodeVerifier } from "@/lib/auth/app-redirect";
import { decodePendingSignIn, encodePendingSignIn, pkceChallenge } from "@/lib/auth/oidc";

describe("flat SVG swatches for the app", () => {
  it.each(PATTERNS.flatMap((pattern) => TONES.map((tone) => [pattern, tone] as const)))(
    "draws %s on %s exactly as the website does",
    (pattern, tone) => {
      const { content } = drawArt({ pattern, tone, seed: 424242 });
      expect(svgMarkup(content)).toBe(renderToStaticMarkup(createElement("g", null, content)).replace(/^<g>|<\/g>$/g, ""));
    },
  );

  it("is a standalone document with the tone's ground colour and no filters", () => {
    const svg = artSvg({ pattern: "moons", tone: "deep", seed: 7 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"')).toBe(true);
    expect(svg).toContain('fill="#18214f"');
    expect(svg).not.toContain("filter");
    expect(svg).toContain('stroke-width="1.7"');
  });

  it("names files by what they show, and reads the names back", () => {
    const spec = { pattern: "waves", tone: "light", seed: 4_294_967_295 } as const;
    expect(artPath(spec)).toBe(`/api/v1/art/${ART_VERSION}/waves-light-4294967295.svg`);
    expect(parseArtFileName("waves-light-4294967295.svg")).toEqual(spec);
  });

  it("uses the same unsigned seed the drawing code does", () => {
    expect(artPath({ pattern: "seeds", tone: "mid", seed: -5 })).toBe(`/api/v1/art/${ART_VERSION}/seeds-mid-4294967291.svg`);
    expect(artSvg({ pattern: "seeds", tone: "mid", seed: -5 })).toBe(artSvg({ pattern: "seeds", tone: "mid", seed: 4_294_967_291 }));
  });

  it.each(["plaid-deep-1.svg", "moons-neon-1.svg", "moons-deep-4294967296.svg", "moons-deep-1.png", "../moons-deep-1.svg", "moons-deep-.svg"])(
    "refuses %s",
    (name) => {
      expect(parseArtFileName(name)).toBeNull();
    },
  );
});

describe("app sign-in redirects", () => {
  it.each([
    "ilearo://auth",
    "ilearo://auth/",
    "exp://192.168.1.20:8081/--/auth",
    "exp://10.0.0.5:8081/--/auth",
    "exp://172.20.10.2:8081/--/auth",
    "exps://127.0.0.1:8081/--/auth",
    "exp://localhost:8081/--/auth",
  ])("sends sign-ins back to %s", (uri) => {
    expect(isAllowedAppRedirect(uri)).toBe(true);
  });

  it.each([
    ["a website", "https://evil.example/steal"],
    ["this site over http", "http://localhost:3000/--/auth"],
    ["another app path", "ilearo://orders"],
    ["a query string", "ilearo://auth?next=https://evil.example"],
    ["a fragment", "ilearo://auth#x"],
    ["Expo Go on a public address", "exp://203.0.113.9:8081/--/auth"],
    ["an Expo tunnel", "exp://abc-anonymous-8081.exp.direct/--/auth"],
    ["a lookalike private address", "exp://192.168.1.20.evil.example:8081/--/auth"],
    ["an impossible address", "exp://192.168.300.1:8081/--/auth"],
    ["an address written in octal (8.8.8.8)", "exp://010.010.010.010:8081/--/auth"],
    ["leading zeros", "exp://192.168.01.20:8081/--/auth"],
    ["a hex address", "exp://0x0a.0.0.1:8081/--/auth"],
    ["a short-form address", "exp://10.1:8081/--/auth"],
    ["Expo Go without the app path", "exp://192.168.1.20:8081/"],
    ["credentials in the address", "exp://user:pass@192.168.1.20:8081/--/auth"],
    ["another scheme", "javascript://auth"],
    ["nothing", ""],
  ])("refuses %s", (_label, uri) => {
    expect(isAllowedAppRedirect(uri)).toBe(false);
  });

  it("only allows the browser test address when testing", () => {
    expect(isAllowedAppRedirect("http://localhost:3200/auth")).toBe(false);
    expect(isAllowedAppRedirect("http://localhost:3200/auth", { testing: true })).toBe(true);
    expect(isAllowedAppRedirect("http://evil.example/auth", { testing: true })).toBe(false);
    expect(isAllowedAppRedirect("https://localhost:3200/auth", { testing: true })).toBe(false);
  });

  it("adds the result to the app's address", () => {
    expect(appRedirectUrl("ilearo://auth", { code: "abc" })).toBe("ilearo://auth?code=abc");
    expect(appRedirectUrl("exp://192.168.1.20:8081/--/auth", { error: "cancelled" })).toBe(
      "exp://192.168.1.20:8081/--/auth?error=cancelled",
    );
  });

  it("checks PKCE values", async () => {
    const verifier = "a".repeat(43);
    expect(isCodeVerifier(verifier)).toBe(true);
    expect(isCodeVerifier("short")).toBe(false);
    expect(isCodeChallenge(await pkceChallenge(verifier))).toBe(true);
    expect(isCodeChallenge("not a challenge")).toBe(false);
  });

  it("remembers an app sign-in in the pending cookie, and drops a tampered one", async () => {
    const app = { redirectUri: "ilearo://auth", codeChallenge: await pkceChallenge("b".repeat(43)) };
    const pending = { state: "s", nonce: "n", verifier: "v", returnTo: "/" };
    expect(decodePendingSignIn(encodePendingSignIn({ ...pending, app }))).toEqual({ ...pending, app });
    expect(decodePendingSignIn(encodePendingSignIn(pending))).toEqual(pending);
    expect(decodePendingSignIn(encodePendingSignIn({ ...pending, app: { ...app, redirectUri: "https://evil.example" } }))).toBeNull();
  });
});
