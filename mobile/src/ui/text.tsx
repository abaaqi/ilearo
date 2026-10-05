import { Text as RNText, StyleSheet, type TextProps } from "react-native";
import { colors, fonts } from "./theme";

type Variant = "display" | "title" | "heading" | "body" | "lead" | "small" | "label" | "strong";

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44, color: colors.pit, letterSpacing: 0.2 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: colors.pit, letterSpacing: 0.2 },
  heading: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, color: colors.pit },
  lead: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 27, color: colors.pit },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.pit },
  strong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.pit },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.faded },
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.pit },
});

/** Text in the shop's type styles. Numbers line up (tabular figures) so prices don't jump. */
export function Text({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  const role = variant === "display" || variant === "title" || variant === "heading" ? "header" : undefined;
  return (
    <RNText
      accessibilityRole={role}
      maxFontSizeMultiplier={variant === "display" ? 1.4 : 1.8}
      {...props}
      style={[styles[variant], { fontVariant: ["tabular-nums"] }, style]}
    />
  );
}
