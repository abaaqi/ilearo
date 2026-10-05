import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./text";
import { colors, fonts } from "./theme";

type Props = {
  value: number;
  /** What the quantity is of, for screen readers: "Oniko bucket hat". */
  itemName: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
};

/** The − 2 + control, with the same labels as the website's cart. */
export function Stepper({ value, itemName, canDecrease, canIncrease, onDecrease, onIncrease, disabled = false }: Props) {
  return (
    <View style={styles.row}>
      <StepButton symbol="−" label={`One fewer ${itemName}`} enabled={canDecrease && !disabled} onPress={onDecrease} />
      <View style={styles.value} accessible accessibilityLabel={`Quantity of ${itemName}: ${value}`}>
        <Text variant="strong" style={styles.valueText}>
          {value}
        </Text>
      </View>
      <StepButton symbol="+" label={`One more ${itemName}`} enabled={canIncrease && !disabled} onPress={onIncrease} />
    </View>
  );
}

function StepButton({ symbol, label, enabled, onPress }: { symbol: string; label: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.button, pressed && enabled && styles.pressed, !enabled && styles.disabled]}
    >
      <Text style={styles.symbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },
  button: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  pressed: { backgroundColor: colors.starch },
  disabled: { opacity: 0.35 },
  symbol: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 28, color: colors.pit },
  value: {
    minWidth: 48,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  valueText: { fontSize: 17 },
});
