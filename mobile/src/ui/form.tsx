import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./text";
import { colors, fonts, GUTTER } from "./theme";

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

/** A labelled text box with an optional hint and error, like the website's checkout fields. */
export function Field({ label, hint, error, optional = false, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}
        {optional ? <Text variant="small"> (optional)</Text> : null}
      </Text>
      {hint ? <Text variant="small">{hint}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={[hint, error].filter(Boolean).join(". ") || undefined}
        placeholderTextColor={colors.faded}
        selectionColor={colors.indigo}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
        style={[styles.input, input.multiline && styles.multiline, focused && styles.focused, error ? styles.invalid : null]}
      />
    </View>
  );
}

type PickerProps = {
  label: string;
  value: string;
  options: { value: string; label: string; note?: string }[];
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
};

/** A choice from a long list (Nigeria's states), opened as a full-height sheet. */
export function Picker({ label, value, options, placeholder, error, onChange }: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : "not chosen"}`}
        accessibilityHint="Opens the list to choose from"
        style={[styles.input, styles.pickerButton, error ? styles.invalid : null]}
        testID={`picker-${label}`}
      >
        <Text style={selected ? undefined : styles.placeholder}>{selected ? selected.label : placeholder}</Text>
        <Feather name="chevron-down" size={20} color={colors.pit} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Text variant="heading">{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
              <Feather name="x" size={24} color={colors.pit} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(option) => option.value}
            initialNumToRender={40}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  <Text style={active ? styles.optionActive : undefined}>{item.label}</Text>
                  {item.note ? <Text variant="small">{item.note}</Text> : null}
                  {active ? <Feather name="check" size={20} color={colors.pit} style={styles.check} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cloth,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.pit,
    marginTop: 4,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  focused: { borderColor: colors.indigo, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 10 },
  invalid: { borderColor: colors.alert, borderWidth: 2 },
  error: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.alert },
  pickerButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  placeholder: { color: colors.faded },
  sheet: { flex: 1, backgroundColor: colors.resist },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: GUTTER,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.wash,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: GUTTER,
    borderBottomWidth: 1,
    borderBottomColor: colors.wash,
  },
  optionPressed: { backgroundColor: colors.starch },
  optionActive: { fontFamily: fonts.semibold },
  check: { marginLeft: "auto" },
});
