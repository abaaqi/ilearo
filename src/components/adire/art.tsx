/**
 * Generated adire swatches. Every product without a photo gets a pattern
 * drawn from its seed, so the same product always looks the same.
 *
 * Patterns follow the three resist techniques the shop sells:
 *   oniko (tied)            → moons, seeds, sunburst
 *   eleko (starch-painted)  → panels, waves
 *   alabere (stitched)      → stripes, ladder, chevron
 *
 * The SVG filters these swatches reference (#adire-bleed, #adire-cloud,
 * #adire-weave) are defined once per page by <AdireFilters />.
 */
import type { ReactNode } from "react";

export const PATTERNS = ["moons", "seeds", "sunburst", "panels", "waves", "stripes", "ladder", "chevron"] as const;
export type PatternName = (typeof PATTERNS)[number];

export const TONES = ["deep", "mid", "light"] as const;
export type Tone = (typeof TONES)[number];

export type ArtSpec = { pattern: PatternName; seed: number; tone: Tone };

export type Palette = { ground: string; resist: string; half: string };

export const PALETTES: Record<Tone, Palette> = {
  deep: { ground: "#18214f", resist: "#e4eaf5", half: "#7f93c4" },
  mid: { ground: "#22337a", resist: "#e6ecf7", half: "#8ea2d3" },
  light: { ground: "#3b569b", resist: "#eef2fa", half: "#a9badf" },
};

export type Rand = () => number;

/** mulberry32: small, fast, deterministic. */
export function makeRand(seed: number): Rand {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const jitter = (rand: Rand, amount: number) => (rand() - 0.5) * 2 * amount;
const TAU = Math.PI * 2;

/** A full circle as path data, so many circles can share one <path>. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r * 2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r * 2)} 0`;
}

/* ------------------------------------------------------------------ oniko */

function tiedMoon(key: string, cx: number, cy: number, radius: number, rand: Rand, c: Palette, rays = 22): ReactNode {
  const count = rays + Math.floor(rand() * 8);
  let d = "";
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + jitter(rand, 0.09);
    const inner = radius * (0.34 + rand() * 0.07);
    const outer = radius * (0.74 + rand() * 0.22);
    d += `M${r1(cx + Math.cos(a) * inner)} ${r1(cy + Math.sin(a) * inner)}L${r1(cx + Math.cos(a) * outer)} ${r1(cy + Math.sin(a) * outer)}`;
  }
  return (
    <g key={key}>
      <circle cx={r1(cx)} cy={r1(cy)} r={r1(radius * 1.16)} fill={c.half} opacity={0.2} />
      <circle cx={r1(cx)} cy={r1(cy)} r={r1(radius)} fill="none" stroke={c.resist} strokeWidth={r1(radius * 0.11)} />
      <path d={d} stroke={c.resist} strokeWidth={1.7} strokeLinecap="round" opacity={0.78} />
      <circle cx={r1(cx)} cy={r1(cy)} r={r1(radius * 0.3)} fill={c.resist} />
      <circle cx={r1(cx)} cy={r1(cy)} r={r1(radius * 0.1)} fill={c.ground} opacity={0.85} />
    </g>
  );
}

function moons(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  const step = 132;
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * step + (row % 2 === 0 ? 0 : step / 2) + 44 + jitter(rand, 7);
      const cy = row * step * 0.87 + 52 + jitter(rand, 7);
      out.push(tiedMoon(`m${row}.${col}`, cx, cy, 44 + rand() * 12, rand, c));
    }
  }
  return out;
}

function seeds(rand: Rand, c: Palette): ReactNode[] {
  let rings = "";
  let dots = "";
  const step = 40;
  for (let row = -1; row < 13; row++) {
    for (let col = -1; col < 12; col++) {
      if (rand() < 0.07) continue;
      const cx = col * step + (row % 2 === 0 ? 0 : step / 2) + 14 + jitter(rand, 3);
      const cy = row * step * 0.88 + 14 + jitter(rand, 3);
      rings += circlePath(cx, cy, 8 + rand() * 4);
      dots += circlePath(cx, cy, 2.3);
    }
  }
  return [
    <path key="rings" d={rings} fill="none" stroke={c.resist} strokeWidth={2.7} />,
    <path key="dots" d={dots} fill={c.resist} />,
  ];
}

function sunburst(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = col * 200 + (row % 2 === 0 ? 0 : 100) + jitter(rand, 8);
      const cy = row * 175 + 30 + jitter(rand, 8);
      out.push(
        <circle key={`h${row}.${col}`} cx={r1(cx)} cy={r1(cy)} r={92} fill="none" stroke={c.half} strokeWidth={2} opacity={0.6} />,
      );
      out.push(tiedMoon(`s${row}.${col}`, cx, cy, 70 + rand() * 10, rand, c, 34));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ eleko */

export const MOTIFS = [
  "spiral",
  "squares",
  "combs",
  "dots",
  "leaf",
  "cross",
  "rings",
  "zigzag",
  "crescent",
  "scallops",
  "sun",
  "chevrons",
] as const;
export type Motif = (typeof MOTIFS)[number];

/** One hand-painted motif inside the square (x, y, size). */
export function drawMotif(name: Motif, x: number, y: number, size: number, rand: Rand, c: Palette, key?: string): ReactNode {
  const pad = size * 0.2;
  const w = size - pad * 2;
  const ix = x + pad;
  const iy = y + pad;
  const mx = x + size / 2;
  const my = y + size / 2;
  const sw = r1(size * 0.034);
  const stroke = { fill: "none", stroke: c.resist, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "spiral": {
      const turns = 3;
      let d = "";
      for (let i = 0; i <= 90; i++) {
        const t = (i / 90) * turns * TAU;
        const rad = (w / 2) * (i / 90);
        d += `${i === 0 ? "M" : "L"}${r1(mx + Math.cos(t) * rad)} ${r1(my + Math.sin(t) * rad)}`;
      }
      return <path key={key} d={d} {...stroke} />;
    }
    case "squares": {
      return (
        <g key={key} {...stroke}>
          <rect x={r1(ix)} y={r1(iy)} width={r1(w)} height={r1(w)} />
          <rect x={r1(ix + w * 0.18)} y={r1(iy + w * 0.18)} width={r1(w * 0.64)} height={r1(w * 0.64)} />
          <rect x={r1(ix + w * 0.38)} y={r1(iy + w * 0.38)} width={r1(w * 0.24)} height={r1(w * 0.24)} fill={c.resist} />
        </g>
      );
    }
    case "combs": {
      let d = `M${r1(ix)} ${r1(iy)}H${r1(ix + w)}`;
      for (let i = 0; i < 6; i++) {
        const lx = ix + (w / 5) * i;
        d += `M${r1(lx)} ${r1(iy)}V${r1(iy + w * (0.7 + rand() * 0.3))}`;
      }
      return <path key={key} d={d} {...stroke} />;
    }
    case "dots": {
      let d = "";
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) d += circlePath(ix + (w / 3) * i, iy + (w / 3) * j, w * 0.06);
      return <path key={key} d={d} fill={c.resist} />;
    }
    case "leaf": {
      let d = `M${r1(mx)} ${r1(iy)}Q${r1(ix + w * 1.05)} ${r1(my)} ${r1(mx)} ${r1(iy + w)}Q${r1(ix - w * 0.05)} ${r1(my)} ${r1(mx)} ${r1(iy)}Z`;
      d += `M${r1(mx)} ${r1(iy + w * 0.08)}V${r1(iy + w * 0.92)}`;
      for (let i = 1; i <= 3; i++) {
        const vy = iy + w * (0.2 + i * 0.17);
        d += `M${r1(mx)} ${r1(vy)}l${r1(w * 0.2)} ${r1(-w * 0.12)}M${r1(mx)} ${r1(vy)}l${r1(-w * 0.2)} ${r1(-w * 0.12)}`;
      }
      return <path key={key} d={d} {...stroke} />;
    }
    case "cross": {
      let dots = "";
      for (const [dx, dy] of [
        [0.18, 0.18],
        [0.82, 0.18],
        [0.18, 0.82],
        [0.82, 0.82],
      ] as const) {
        dots += circlePath(ix + w * dx, iy + w * dy, w * 0.07);
      }
      return (
        <g key={key}>
          <path
            d={`M${r1(mx)} ${r1(iy + w * 0.05)}V${r1(iy + w * 0.95)}M${r1(ix + w * 0.05)} ${r1(my)}H${r1(ix + w * 0.95)}`}
            {...stroke}
            strokeWidth={r1(sw * 2.4)}
          />
          <path d={dots} fill={c.resist} />
        </g>
      );
    }
    case "rings": {
      let rings = "";
      let dots = "";
      for (const [dx, dy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ] as const) {
        rings += circlePath(ix + w * dx, iy + w * dy, w * 0.2);
        dots += circlePath(ix + w * dx, iy + w * dy, w * 0.05);
      }
      return (
        <g key={key}>
          <path d={rings} {...stroke} />
          <path d={dots} fill={c.resist} />
        </g>
      );
    }
    case "zigzag": {
      let d = "";
      for (let row = 0; row < 4; row++) {
        const zy = iy + w * 0.08 + row * w * 0.28;
        d += `M${r1(ix)} ${r1(zy)}`;
        for (let k = 1; k <= 6; k++) d += `L${r1(ix + (w / 6) * k)} ${r1(zy + (k % 2 === 1 ? w * 0.14 : 0))}`;
      }
      return <path key={key} d={d} {...stroke} />;
    }
    case "crescent": {
      // Outer arc runs the long way round the left; the flatter inner arc
      // comes back, leaving a moon about one radius thick.
      const R = w * 0.42;
      const tx = mx + R * 0.35;
      const d = `M${r1(tx)} ${r1(my - R * 0.9)}A${r1(R)} ${r1(R)} 0 1 0 ${r1(tx)} ${r1(my + R * 0.9)}A${r1(R * 1.1)} ${r1(R * 1.1)} 0 0 1 ${r1(tx)} ${r1(my - R * 0.9)}Z`;
      const stars = circlePath(ix + w * 0.86, iy + w * 0.2, w * 0.05) + circlePath(ix + w * 0.92, iy + w * 0.52, w * 0.04) + circlePath(ix + w * 0.84, iy + w * 0.82, w * 0.05);
      return (
        <g key={key}>
          <path d={d} fill={c.resist} />
          <path d={stars} fill={c.resist} />
        </g>
      );
    }
    case "scallops": {
      let d = "";
      const rad = w / 6;
      for (let row = 0; row < 3; row++) {
        const sy = iy + rad + row * w * 0.34;
        for (let k = 0; k < 3; k++) {
          const sx = ix + k * rad * 2;
          d += `M${r1(sx)} ${r1(sy)}a${r1(rad)} ${r1(rad)} 0 0 0 ${r1(rad * 2)} 0`;
        }
      }
      return <path key={key} d={d} {...stroke} />;
    }
    case "sun": {
      let rays = "";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        rays += `M${r1(mx + Math.cos(a) * w * 0.3)} ${r1(my + Math.sin(a) * w * 0.3)}L${r1(mx + Math.cos(a) * w * 0.48)} ${r1(my + Math.sin(a) * w * 0.48)}`;
      }
      return (
        <g key={key}>
          <path d={circlePath(mx, my, w * 0.19)} fill={c.resist} />
          <path d={rays} {...stroke} />
        </g>
      );
    }
    case "chevrons": {
      let d = "";
      for (let k = 0; k < 3; k++) {
        const cy = iy + w * 0.15 + k * w * 0.3;
        d += `M${r1(ix)} ${r1(cy)}L${r1(mx)} ${r1(cy + w * 0.24)}L${r1(ix + w)} ${r1(cy)}`;
      }
      return <path key={key} d={d} {...stroke} />;
    }
  }
}

/** Picks motifs for a grid so no two neighbours repeat. */
export function chooseMotifs(count: number, columns: number, rand: Rand): Motif[] {
  const picked: Motif[] = [];
  for (let i = 0; i < count; i++) {
    const left = i % columns === 0 ? undefined : picked[i - 1];
    const above = picked[i - columns];
    let choice: Motif;
    do {
      choice = MOTIFS[Math.floor(rand() * MOTIFS.length)] ?? "spiral";
    } while (choice === left || choice === above);
    picked.push(choice);
  }
  return picked;
}

function panelFrame(key: string, x: number, y: number, size: number, c: Palette): ReactNode {
  return (
    <g key={key} fill="none" stroke={c.resist}>
      <rect x={r1(x + 3)} y={r1(y + 3)} width={r1(size - 6)} height={r1(size - 6)} strokeWidth={3} />
      <rect x={r1(x + 9)} y={r1(y + 9)} width={r1(size - 18)} height={r1(size - 18)} strokeWidth={1.3} opacity={0.75} />
    </g>
  );
}

function panels(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  const n = 4;
  const size = 400 / n;
  const motifs = chooseMotifs(n * n, n, rand);
  motifs.forEach((m, i) => {
    const x = (i % n) * size;
    const y = Math.floor(i / n) * size;
    out.push(panelFrame(`f${i}`, x, y, size, c));
    out.push(drawMotif(m, x, y, size, rand, c, `m${i}`));
  });
  return out;
}

function waves(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  let y = 10;
  let band = 0;
  while (y < 420) {
    if (band % 4 === 3) {
      const rad = 11;
      let arcs = "";
      let dots = "";
      for (let x = -rad; x < 420; x += rad * 2) {
        arcs += `M${x} ${r1(y)}a${rad} ${rad} 0 0 0 ${rad * 2} 0`;
        dots += circlePath(x + rad, y + 4, 2.4);
      }
      out.push(<path key={`s${band}`} d={arcs} fill="none" stroke={c.resist} strokeWidth={3} />);
      out.push(<path key={`d${band}`} d={dots} fill={c.resist} />);
      y += 30;
    } else {
      const amp = 5 + rand() * 3;
      const half = 24 + rand() * 6;
      let d = `M${r1(-half * rand() * 2)} ${r1(y)}q${r1(half / 2)} ${r1(-amp * 2)} ${r1(half)} 0`;
      for (let x = 0; x < 440; x += half) d += `t${r1(half)} 0`;
      out.push(
        <path key={`w${band}`} d={d} fill="none" stroke={c.resist} strokeWidth={band % 4 === 1 ? 2 : 3.2} strokeLinecap="round" opacity={band % 4 === 1 ? 0.75 : 1} />,
      );
      y += 19;
    }
    band++;
  }
  return out;
}

/* ---------------------------------------------------------------- alabere */

function stripes(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  let y = 8;
  let band = 0;
  while (y < 420) {
    out.push(<rect key={`h${band}`} x={0} y={r1(y - 7)} width={400} height={32} fill={c.half} opacity={0.1} />);
    for (let i = 0; i < 3; i++) {
      const dash = 6 + rand() * 3;
      const gap = 3.5 + rand() * 2.5;
      const ly = r1(y + i * 9 + jitter(rand, 0.8));
      out.push(
        <line
          key={`l${band}.${i}`}
          x1={-6}
          x2={406}
          y1={ly}
          y2={ly}
          stroke={c.resist}
          strokeWidth={3.1}
          strokeDasharray={`${r1(dash)} ${r1(gap)}`}
          strokeDashoffset={r1(rand() * 10)}
          strokeLinecap="round"
        />,
      );
    }
    y += 27 + 24 + rand() * 10;
    band++;
  }
  return out;
}

function ladder(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  const width = 28;
  for (let x = 20 + rand() * 20, i = 0; x < 420; x += 96, i++) {
    const rails = `M${r1(x)} -6V406M${r1(x + width)} -6V406`;
    let rungs = "";
    for (let y = 6 + rand() * 6; y < 404; y += 14) rungs += `M${r1(x + 5)} ${r1(y)}H${r1(x + width - 5)}`;
    out.push(<path key={`r${i}`} d={rails} stroke={c.resist} strokeWidth={3} strokeDasharray="7 4" strokeLinecap="round" />);
    out.push(<path key={`g${i}`} d={rungs} stroke={c.resist} strokeWidth={2.4} strokeDasharray="4 3" strokeLinecap="round" />);
    out.push(
      <path key={`d${i}`} d={`M${r1(x + 62)} -6V406`} stroke={c.half} strokeWidth={2.4} strokeDasharray="0.5 8" strokeLinecap="round" />,
    );
  }
  return out;
}

function chevron(rand: Rand, c: Palette): ReactNode[] {
  const out: ReactNode[] = [];
  const period = 52;
  const amp = 14;
  for (let y = 4 + rand() * 8, i = 0; y < 430; y += 30, i++) {
    let d = `M-26 ${r1(y)}`;
    for (let k = 1, x = -26; x < 430; k++) {
      x += period / 2;
      d += `L${r1(x)} ${r1(y + (k % 2 === 1 ? amp : 0))}`;
    }
    const quiet = i % 3 === 2;
    out.push(
      <path
        key={`c${i}`}
        d={d}
        fill="none"
        stroke={quiet ? c.half : c.resist}
        strokeWidth={quiet ? 2.4 : 3.1}
        strokeDasharray={quiet ? "0.5 7" : `${r1(6 + rand() * 2)} 4`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
  }
  return out;
}

/* ------------------------------------------------------------------ public */

const DRAW: Record<PatternName, (rand: Rand, c: Palette) => ReactNode[]> = {
  moons,
  seeds,
  sunburst,
  panels,
  waves,
  stripes,
  ladder,
  chevron,
};

const DESCRIPTIONS: Record<PatternName, string> = {
  moons: "large tied moons with fine rays",
  seeds: "rows of small tied rings",
  sunburst: "big tied sunbursts",
  panels: "a grid of hand-painted panels",
  waves: "bands of painted waves and scallops",
  stripes: "bands of stitched stripes",
  ladder: "stitched ladders",
  chevron: "stitched zigzags",
};

const TONE_WORDS: Record<Tone, string> = { deep: "deep indigo", mid: "indigo", light: "light indigo" };

export function describeArt(spec: ArtSpec): string {
  return `Pale ${DESCRIPTIONS[spec.pattern]} on ${TONE_WORDS[spec.tone]} cotton`;
}

/** Turns whatever is stored in products.art into a usable spec. */
export function toArtSpec(raw: unknown, fallbackSeed: number): ArtSpec {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pattern = PATTERNS.includes(value.pattern as PatternName) ? (value.pattern as PatternName) : "moons";
  const tone = TONES.includes(value.tone as Tone) ? (value.tone as Tone) : "deep";
  const seed = typeof value.seed === "number" && Number.isFinite(value.seed) ? value.seed : fallbackSeed;
  return { pattern, seed, tone };
}

/** A stable number from a string, for seeding art when none is stored. */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The pattern's shapes and colours, before any texture is added. Also used for the app's flat SVGs. */
export function drawArt(spec: ArtSpec): { palette: Palette; content: ReactNode[] } {
  const palette = PALETTES[spec.tone];
  return { palette, content: DRAW[spec.pattern](makeRand(spec.seed), palette) };
}

type AdireArtProps = {
  spec: ArtSpec;
  /** Give a label when the image carries meaning; leave it out when it is decorative. */
  label?: string;
  className?: string;
};

export function AdireArt({ spec, label, className }: AdireArtProps) {
  const { palette: c, content } = drawArt(spec);
  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <rect width="400" height="400" fill={c.ground} />
      <g filter="url(#adire-bleed)">{content}</g>
      <rect width="400" height="400" filter="url(#adire-cloud)" opacity={0.42} />
      <rect width="400" height="400" filter="url(#adire-weave)" />
    </svg>
  );
}

/** Shared SVG filters for every swatch on the page. Render once, in the root layout. */
export function AdireFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        {/* Wobbles and softens edges, like dye creeping under starch and thread. */}
        <filter id="adire-bleed" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={4} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={4.5} xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feGaussianBlur in="wobbly" stdDeviation={0.45} />
        </filter>
        {/* The same bleed, scaled for a single 100-unit panel (the home page cloth). */}
        <filter id="adire-bleed-panel" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves={2} seed={4} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={1.4} xChannelSelector="R" yChannelSelector="G" result="wobbly" />
          <feGaussianBlur in="wobbly" stdDeviation={0.14} />
        </filter>
        {/* Uneven dye: soft darker clouds across the cloth. */}
        <filter id="adire-cloud" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.014" numOctaves={3} seed={9} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.06  0 0 0 0 0.17  1.6 0 0 0 -0.62" />
        </filter>
        {/* Fine cotton grain. */}
        <filter id="adire-weave" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.75" numOctaves={1} seed={2} />
          <feColorMatrix type="matrix" values="0 0 0 0 0.92  0 0 0 0 0.94  0 0 0 0 1  0.16 0 0 0 0" />
        </filter>
      </defs>
    </svg>
  );
}
