import { ART_VERSION, artSvg, parseArtFileName } from "@/lib/art-svg";

/**
 * GET /api/v1/art/v1/moons-deep-12345.svg: a product swatch as a flat SVG,
 * drawn by the same code as the website's. The address says exactly what is
 * drawn, so the picture never changes and can be cached for good.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ version: string; file: string }> }) {
  const { version, file } = await params;
  const spec = version === ART_VERSION ? parseArtFileName(file) : null;
  if (!spec) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const forever = "public, max-age=31536000, immutable";
  return new Response(artSvg(spec), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": forever,
      // Lets Netlify's and Vercel's CDNs keep a copy too.
      "CDN-Cache-Control": forever,
      // Scripts in an SVG opened on its own would run; there are none, and this keeps it that way.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
