import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogoMark } from "./logo-mark";
import { Text } from "./text";
import { colors, fonts, GUTTER } from "./theme";

/** Shown when the app hasn't been told where the shop is. */
export function SetupNeeded() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <LogoMark size={48} />
        <Text variant="title" style={styles.gap}>
          Point the app at your shop
        </Text>
        <Text style={styles.gap}>
          The app uses your website&apos;s API, so it needs the website&apos;s address. In the mobile folder, copy
          .env.example to .env and set:
        </Text>
        <View style={styles.code}>
          <Text style={styles.codeText}>EXPO_PUBLIC_SHOP_URL=https://your-site.netlify.app</Text>
        </View>
        <Text style={styles.gap}>Then stop Expo and start it again with npx expo start.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.resist },
  content: { padding: GUTTER, paddingTop: 48 },
  gap: { marginTop: 16 },
  code: { marginTop: 16, backgroundColor: colors.pit, padding: 14 },
  codeText: { color: colors.starch, fontFamily: fonts.medium, fontSize: 14 },
});
