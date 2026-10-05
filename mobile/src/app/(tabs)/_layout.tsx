import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/state/cart";
import { colors, fonts } from "@/ui/theme";

export default function TabsLayout() {
  const { cart } = useCart();
  const insets = useSafeAreaInsets();
  const count = cart?.itemCount ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pit,
        tabBarInactiveTintColor: colors.faded,
        // Each tab needs 5 + 28 (icon) + 16 (label) + 5 points; the default bar is
        // shorter than that with Commissioner's taller line height, which clips the labels.
        tabBarStyle: {
          backgroundColor: colors.cloth,
          borderTopColor: colors.wash,
          height: 64 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 4),
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.resist },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.pit, color: colors.starch, fontFamily: fonts.semibold, fontSize: 11 },
          tabBarAccessibilityLabel: `Cart, ${count} ${count === 1 ? "item" : "items"}`,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
