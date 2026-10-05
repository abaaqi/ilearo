import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";
import { colors, GUTTER } from "./theme";

/** A message with a coloured edge, like the website's notices. */
export function Notice({ tone = "info", title, children }: { tone?: "info" | "error"; title?: string; children?: ReactNode }) {
  return (
    <View
      style={[styles.notice, tone === "error" && styles.error]}
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      {title ? (
        <Text variant="strong" style={tone === "error" ? styles.errorText : undefined}>
          {title}
        </Text>
      ) : null}
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.centre} accessible accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.pit} />
    </View>
  );
}

/** When the shop can't be reached: say so plainly and offer to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.centre, styles.padded]}>
      <Text variant="title" style={styles.centredText}>
        Something&apos;s not right
      </Text>
      <Text style={[styles.centredText, styles.gap]}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} style={styles.gap} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderLeftWidth: 4, borderLeftColor: colors.pit, backgroundColor: colors.cloth, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  error: { borderLeftColor: colors.alert },
  errorText: { color: colors.alert },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  padded: { paddingHorizontal: GUTTER },
  centredText: { textAlign: "center" },
  gap: { marginTop: 14 },
});
