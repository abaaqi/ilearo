/**
 * Draws the mobile app's icons and cloth textures with the same SVG as the
 * website, using the Chromium that Playwright installs for the tests.
 *
 *   node scripts/render-app-assets.mjs
 *
 * Writes mobile/assets/{icon,adaptive-icon,splash-icon,favicon}.png and
 * mobile/assets/textures/{cloud,weave}.png. Only needed again if the logo or
 * the website's texture filters change. The committed copies were then shrunk
 * to 256-colour PNGs (Pillow: Image.quantize(256, FASTOCTREE)), which keeps
 * the app small.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "mobile", "assets");
mkdirSync(path.join(out, "textures"), { recursive: true });

const PIT = "#141c45";
const STARCH = "#e4eaf5";

/** The logo's tied moon, as in src/components/logo-mark.tsx, on a 32-unit grid. */
function moon({ ink, resist, outer = true }) {
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = (r) => `${(16 + Math.cos(a) * r).toFixed(2)} ${(16 + Math.sin(a) * r).toFixed(2)}`;
    rays += `M${p(6.2)}L${p(11.2)}`;
  }
  return `${outer ? `<circle cx="16" cy="16" r="14" fill="${ink}"/>` : ""}
    <circle cx="16" cy="16" r="12.4" fill="none" stroke="${resist}" stroke-width="1.8"/>
    <path d="${rays}" stroke="${resist}" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="4.2" fill="${resist}"/>
    <circle cx="16" cy="16" r="1.4" fill="${ink}"/>`;
}

/** The website's texture filters (src/components/adire/art.tsx), unchanged. */
const FILTERS = `
  <filter id="cloud" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves="3" seed="9"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.06  0 0 0 0 0.17  1.6 0 0 0 -0.62"/>
  </filter>
  <filter id="weave" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9 0.75" numOctaves="1" seed="2"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.92  0 0 0 0 0.94  0 0 0 0 1  0.16 0 0 0 0"/>
  </filter>`;

const assets = [
  {
    // Soft, slow-changing clouds: a small image stretches without showing it.
    file: "textures/cloud.png",
    size: 320,
    transparent: true,
    svg: `<svg viewBox="0 0 400 400"><defs>${FILTERS}</defs><rect width="400" height="400" filter="url(#cloud)"/></svg>`,
  },
  {
    file: "textures/weave.png",
    size: 512,
    transparent: true,
    svg: `<svg viewBox="0 0 400 400"><defs>${FILTERS}</defs><rect width="400" height="400" filter="url(#weave)"/></svg>`,
  },
  {
    // iOS and the Play Store: a full square, the moon on dyed indigo.
    file: "icon.png",
    size: 1024,
    transparent: false,
    svg: `<svg viewBox="0 0 400 400"><defs>${FILTERS}</defs>
      <rect width="400" height="400" fill="${PIT}"/>
      <rect width="400" height="400" filter="url(#cloud)" opacity="0.42"/>
      <g transform="translate(56 56) scale(9)">${moon({ ink: PIT, resist: STARCH, outer: false })}</g>
      <rect width="400" height="400" filter="url(#weave)"/></svg>`,
  },
  {
    // Android cuts the adaptive icon to a circle or squircle: keep the moon inside the middle 66%.
    file: "adaptive-icon.png",
    size: 1024,
    transparent: true,
    svg: `<svg viewBox="0 0 400 400"><g transform="translate(116 116) scale(5.25)">${moon({ ink: PIT, resist: STARCH, outer: false })}</g></svg>`,
  },
  {
    file: "splash-icon.png",
    size: 512,
    transparent: true,
    svg: `<svg viewBox="0 0 32 32">${moon({ ink: PIT, resist: STARCH, outer: false })}</svg>`,
  },
  {
    file: "favicon.png",
    size: 48,
    transparent: true,
    svg: `<svg viewBox="0 0 32 32">${moon({ ink: PIT, resist: STARCH })}</svg>`,
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const asset of assets) {
  await page.setViewportSize({ width: asset.size, height: asset.size });
  const svg = asset.svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${asset.size}" height="${asset.size}" `);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
  );
  await page.locator("svg").first().screenshot({ path: path.join(out, asset.file), omitBackground: asset.transparent });
  console.log(`wrote mobile/assets/${asset.file}`);
}
await browser.close();
