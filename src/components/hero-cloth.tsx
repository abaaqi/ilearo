import Link from "next/link";
import type { CSSProperties } from "react";
import { chooseMotifs, drawMotif, makeRand, type Palette } from "./adire/art";

const PANELS = 8;
const COLUMNS = 4;
const STARCH: Palette = { ground: "transparent", resist: "#e4eaf5", half: "#8ea2d3" };

/** The home page's opening: a length of eleko cloth with the headline painted into its biggest panel. */
export function HeroCloth() {
  const rand = makeRand(1931);
  const motifs = chooseMotifs(PANELS, COLUMNS, rand);

  return (
    <section aria-labelledby="hero-title" className="hero-cloth on-indigo">
      <div className="hero-lead" style={{ "--dip": 0 } as CSSProperties}>
        <h1 id="hero-title" className="font-stencil text-[clamp(3.1rem,6.4vw,6rem)] text-starch">
          Adire, dyed by hand in Abeokuta
        </h1>
        <p className="mt-5 max-w-[34rem] text-lg text-starch/90">
          Tied, stitched and starch-painted cotton in deep indigo. Sold by the length, and made up into scarves, bags and
          pieces for the home.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/shop" className="btn btn-light">
            Shop all adire
          </Link>
          <Link href="#techniques" className="font-semibold text-starch underline underline-offset-4">
            How it&apos;s made
          </Link>
        </div>
      </div>
      {motifs.map((motif, i) => (
        <div
          key={motif + i}
          aria-hidden="true"
          className="hero-panel"
          style={
            {
              "--dip": 1 + Math.floor(i / COLUMNS) + (i % COLUMNS),
              // Offset the dye texture so neighbouring panels don't repeat it.
              backgroundPosition: `${(i * 137) % 320}px ${(i * 211) % 320}px`,
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" focusable="false">
            <g filter="url(#adire-bleed-panel)">{drawMotif(motif, 0, 0, 100, rand, STARCH)}</g>
          </svg>
        </div>
      ))}
    </section>
  );
}
