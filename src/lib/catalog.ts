/** Names and copy for the shop's categories and dyeing techniques. */

export const CATEGORIES = {
  cloth: { label: "Cloth" },
  scarves: { label: "Scarves" },
  bags: { label: "Bags" },
  home: { label: "Homeware" },
  wear: { label: "Wear" },
} as const;

export type Category = keyof typeof CATEGORIES;

export const TECHNIQUES = {
  oniko: {
    label: "Oniko",
    short: "Tied",
    how: "Small bunches of cloth are bound tight with raffia. The dye can't get under the binding, so each knot opens into a pale ring.",
  },
  alabere: {
    label: "Alabere",
    short: "Stitched",
    how: "Lines of running stitch are sewn in and pulled tight before dyeing, then unpicked to leave soft, broken stripes.",
  },
  eleko: {
    label: "Eleko",
    short: "Starch-painted",
    how: "Cassava starch is painted on freehand or pushed through a cut metal stencil. Once it dries, it keeps the dye out.",
  },
} as const;

export type Technique = keyof typeof TECHNIQUES;

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && Object.hasOwn(CATEGORIES, value);
}

export function isTechnique(value: unknown): value is Technique {
  return typeof value === "string" && Object.hasOwn(TECHNIQUES, value);
}

/** Most of any one item a single cart can hold. */
export const MAX_PER_ITEM = 10;
