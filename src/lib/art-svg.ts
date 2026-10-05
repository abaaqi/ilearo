/**
 * The product swatches as standalone SVG files, for the mobile app.
 *
 * The website draws swatches inline and adds texture with SVG filters. Phone
 * image renderers ignore filters, so the app gets the same shapes flat (the
 * app lays its own cloth texture over them). The drawing code is shared with
 * the website, so a product looks the same everywhere.
 */
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { PATTERNS, TONES, drawArt, type ArtSpec, type PatternName, type Tone } from "@/components/adire/art";

/** Bump when the drawing code changes, so phones fetch the new pictures. */
export const ART_VERSION = "v1";

/** React prop names that are spelled differently as SVG attributes. */
const ATTRIBUTE_NAMES: Record<string, string> = {
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeOpacity: "stroke-opacity",
  fillOpacity: "fill-opacity",
  fillRule: "fill-rule",
  colorInterpolationFilters: "color-interpolation-filters",
};

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c] ?? c);

/** Serialises plain SVG elements the way react-dom/server would. */
export function svgMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(svgMarkup).join("");
  if (typeof node === "string" || typeof node === "number") return escapeXml(String(node));
  if (isValidElement(node) && typeof node.type === "string") {
    const element = node as ReactElement<Record<string, unknown>>;
    let attributes = "";
    for (const [name, value] of Object.entries(element.props)) {
      if (name === "children" || value === null || value === undefined || value === false) continue;
      attributes += ` ${ATTRIBUTE_NAMES[name] ?? name}="${escapeXml(String(value))}"`;
    }
    return `<${element.type}${attributes}>${svgMarkup(element.props.children as ReactNode)}</${element.type}>`;
  }
  throw new Error("Only plain SVG elements can be turned into a file");
}

/** A complete, flat SVG document for one swatch. */
export function artSvg(spec: ArtSpec): string {
  const { palette, content } = drawArt(spec);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" preserveAspectRatio="xMidYMid slice">` +
    `<rect width="400" height="400" fill="${palette.ground}"></rect>${svgMarkup(content)}</svg>`
  );
}

/** Where the app fetches a swatch, relative to the shop's address. */
export function artPath(spec: ArtSpec): string {
  return `/api/v1/art/${ART_VERSION}/${spec.pattern}-${spec.tone}-${spec.seed >>> 0}.svg`;
}

/** Reads "moons-deep-12345.svg" back into a spec, or null if it isn't one. */
export function parseArtFileName(name: string): ArtSpec | null {
  const match = /^([a-z]+)-([a-z]+)-(\d{1,10})\.svg$/.exec(name);
  if (!match) return null;
  const [, pattern, tone, digits] = match;
  const seed = Number(digits);
  if (!PATTERNS.includes(pattern as PatternName) || !TONES.includes(tone as Tone) || seed > 0xffffffff) return null;
  return { pattern: pattern as PatternName, tone: tone as Tone, seed };
}
