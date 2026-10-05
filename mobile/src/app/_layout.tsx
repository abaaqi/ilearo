import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SHOP_URL } from "@/lib/config";
import { CartProvider } from "@/state/cart";
import { SessionProvider } from "@/state/session";
import { ShopProvider } from "@/state/shop";
import { CartNotice } from "@/ui/cart-notice";
import { SetupNeeded } from "@/ui/setup-needed";
import { colors, fonts } from "@/ui/theme";

void SplashScreen.preventAutoHideAsync();

// The font files themselves, not the packages' index files, which would bundle all nine weights.
const FONTS = {
  BigShouldersStencil_800ExtraBold: require("@expo-google-fonts/big-shoulders-stencil/800ExtraBold/BigShouldersStencil_800ExtraBold.ttf"),
  Commissioner_400Regular: require("@expo-google-fonts/commissioner/400Regular/Commissioner_400Regular.ttf"),
  Commissioner_500Medium: require("@expo-google-fonts/commissioner/500Medium/Commissioner_500Medium.ttf"),
  Commissioner_600SemiBold: require("@expo-google-fonts/commissioner/600SemiBold/Commissioner_600SemiBold.ttf"),
  Commissioner_700Bold: require("@expo-google-fonts/commissioner/700Bold/Commissioner_700Bold.ttf"),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {SHOP_URL ? (
        <SessionProvider>
          <ShopProvider>
            <CartProvider>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.resist },
                  headerTintColor: colors.pit,
                  headerTitleStyle: { fontFamily: fonts.semibold, color: colors.pit },
                  headerShadowVisible: false,
                  headerBackButtonDisplayMode: "minimal",
                  contentStyle: { backgroundColor: colors.resist },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Shop" }} />
                <Stack.Screen name="products/[slug]" options={{ title: "" }} />
                <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
                <Stack.Screen name="orders/[reference]" options={{ title: "Your order" }} />
                <Stack.Screen name="auth" options={{ headerShown: false, animation: "none" }} />
              </Stack>
              <CartNotice />
            </CartProvider>
          </ShopProvider>
        </SessionProvider>
      ) : (
        <SetupNeeded />
      )}
    </SafeAreaProvider>
  );
}
