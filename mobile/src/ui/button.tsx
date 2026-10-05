import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./text";
import { colors, fonts } from "./theme";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "light" | "outline" | "link";
  loading?: boolean;
  /** Shown instead of the title while loading, e.g. "Adding…". */
  loadingTitle?: string;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  loadingTitle,
  disabled = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const inactive = disabled || loading;
  const textColor = variant === "primary" ? colors.starch : colors.pit;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      hitSlop={variant === "link" ? 8 : undefined}
      style={({ pressed }) => [
        variant === "link" ? styles.link : styles.base,
        variant === "primary" && styles.primary,
        variant === "light" && styles.light,
        variant === "outline" && styles.outline,
        pressed && !inactive && (variant === "primary" ? styles.primaryPressed : styles.pressed),
        inactive && styles.inactive,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
        <Text
          variant="label"
          style={[
            styles.title,
            { color: textColor },
            variant === "link" && styles.linkTitle,
          ]}
        >
          {loading && loadingTitle ? loadingTitle : title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 22,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  primary: { backgroundColor: colors.pit },
  primaryPressed: { backgroundColor: colors.indigo },
  light: { backgroundColor: colors.starch },
  outline: { borderColor: colors.pit, backgroundColor: "transparent" },
  pressed: { opacity: 0.75 },
  inactive: { opacity: 0.55 },
  link: { minHeight: 44, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, textAlign: "center" },
  linkTitle: { textDecorationLine: "underline", fontSize: 15 },
});
