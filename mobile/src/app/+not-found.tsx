import { router, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button } from "@/ui/button";
import { Text } from "@/ui/text";
import { colors, GUTTER } from "@/ui/theme";

export default function NotFound() {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Not found" }} />
      <Text variant="title">Page not found</Text>
      <Text style={styles.gap}>That screen doesn&apos;t exist. It may have moved, or the link was mistyped.</Text>
      <Button title="Go to the shop" onPress={() => router.navigate("/")} style={styles.gap} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: GUTTER, paddingTop: 32, backgroundColor: colors.resist },
  gap: { marginTop: 16 },
});
