import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/state/cart";
import { Text } from "./text";
import { colors, fonts } from "./theme";

const SHOW_FOR_MS = 4_500;

/**
 * A banner that slides in when the cart changes somewhere else, such as
 * "On the website: Oniko bucket hat added". Tap it to open the cart.
 */
export function CartNotice() {
  const { remoteChange, dismissRemoteChange } = useCart();
  const insets = useSafeAreaInsets();
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!remoteChange) return;
    AccessibilityInfo.announceForAccessibility(`Cart updated on the ${remoteChange.where}. ${remoteChange.text}.`);
    Animated.spring(shown, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    const timer = setTimeout(() => {
      Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => dismissRemoteChange());
    }, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [remoteChange, shown, dismissRemoteChange]);

  if (!remoteChange) return null;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 8 }]}>
      <Animated.View
        style={[
          styles.slide,
          { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
        ]}
      >
        <Pressable
          onPress={() => {
            dismissRemoteChange();
            router.navigate("/cart");
          }}
          accessibilityRole="button"
          accessibilityLabel={`Cart updated on the ${remoteChange.where}: ${remoteChange.text}. Open your cart.`}
          style={styles.banner}
          testID="cart-notice"
        >
          <View style={styles.dot} />
          <View style={styles.texts}>
            <Text style={styles.where}>{remoteChange.where === "website" ? "On the website" : "On another device"}</Text>
            <Text style={styles.what} numberOfLines={2}>
              {remoteChange.text}
            </Text>
          </View>
          <Text style={styles.open}>View</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 12, right: 12, alignItems: "center" },
  slide: { width: "100%", maxWidth: 520 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.pit,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.starch },
  texts: { flex: 1 },
  where: { color: colors.wash, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  what: { color: colors.starch, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  open: { color: colors.starch, fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
});
