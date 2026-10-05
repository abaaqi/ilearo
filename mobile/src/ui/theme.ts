/**
 * The website's palette: every colour is a shade of indigo, from the dye pit
 * to the pale "resist" left where starch, raffia or thread kept the dye out.
 */
export const colors = {
  pit: "#141c45", // deepest indigo: text, primary buttons
  indigo: "#25398a", // links, pressed states, focus
  faded: "#4d6299", // secondary text
  line: "#6b7eb1", // input borders
  wash: "#c7d1e8", // hairlines and quiet dividers
  resist: "#eef2f8", // page background
  cloth: "#fbfcfe", // inputs and raised panels
  starch: "#e4eaf5", // text on indigo
  alert: "#a3262a", // errors only
} as const;

/** Big Shoulders Stencil for display type, Commissioner for text (it has ₦ and Yoruba letters). */
export const fonts = {
  display: "BigShouldersStencil_800ExtraBold",
  regular: "Commissioner_400Regular",
  medium: "Commissioner_500Medium",
  semibold: "Commissioner_600SemiBold",
  bold: "Commissioner_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Side padding for screens, matching the website's 16px phone gutter. */
export const GUTTER = 16;
