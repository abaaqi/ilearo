import AntDesign from "@expo/vector-icons/AntDesign";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { SHOP_HOST } from "@/lib/config";
import { formatNaira, plural } from "@/lib/money";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/state/session";
import { Button } from "@/ui/button";
import { Notice } from "@/ui/feedback";
import { LogoMark } from "@/ui/logo-mark";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { status, user, signIn, signOut, signingIn, signInMessage } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const {
    data: orders,
    error,
    refresh: reloadOrders,
  } = useResource(
    status === "signedIn" && user ? `orders:${user.id}` : null,
    async () => (await api.orders()).orders,
    "Couldn't load your orders.",
  );

  const refresh = async () => {
    setRefreshing(true);
    if (status === "signedIn") await reloadOrders();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pit} colors={[colors.pit]} />}
    >
      <Text variant="display">Your account</Text>

      {status === "signedIn" && user ? (
        <>
          <View style={styles.profile}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} accessible={false} />
            ) : (
              <View style={[styles.avatar, styles.initial]}>
                <Text style={styles.initialText}>{(user.name ?? user.email).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.flex}>
              {user.name ? <Text variant="heading">{user.name}</Text> : null}
              <Text testID="account-email">{user.email}</Text>
              <Text variant="small">Signed in with Google</Text>
            </View>
          </View>
          <Notice>
            <Text variant="small" style={styles.sameAccount}>
              This is the same account as on {SHOP_HOST}. Your cart and orders are shared between the website and this app.
            </Text>
          </Notice>

          <View style={styles.ordersHeading}>
            <Text variant="title">Orders</Text>
          </View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {orders && orders.length === 0 ? <Text>You haven&apos;t placed an order yet.</Text> : null}
          {orders && orders.length > 0 ? (
            <View style={styles.orders}>
              {orders.map((order) => (
                <Link key={order.reference} href={{ pathname: "/orders/[reference]", params: { reference: order.reference } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Order ${order.reference}, ${order.placedOn}, ${order.statusLabel}, ${formatNaira(order.totalKobo)}`}
                    style={({ pressed }) => [styles.order, pressed && styles.pressed]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.reference}>{order.reference}</Text>
                      <Text variant="small">
                        {order.placedOn} · {plural(order.itemCount, "item")} · {order.statusLabel}
                      </Text>
                    </View>
                    <Text variant="strong">{formatNaira(order.totalKobo)}</Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : null}

          <Button
            title="Sign out"
            variant="outline"
            loading={signingOut}
            loadingTitle="Signing out…"
            onPress={async () => {
              setSigningOut(true);
              await signOut();
              setSigningOut(false);
            }}
            style={styles.signOut}
          />
        </>
      ) : (
        <View style={styles.signedOut}>
          <Text variant="lead">
            Sign in with the Google account you use on the Ile Aro website. Your cart and orders follow you between the website and
            this app.
          </Text>
          {signInMessage ? <Notice tone="error">{signInMessage}</Notice> : null}
          <Button
            title="Continue with Google"
            onPress={() => void signIn()}
            loading={signingIn || status === "loading"}
            loadingTitle="Signing in…"
            icon={<AntDesign name="google" size={18} color={colors.starch} />}
            testID="sign-in"
          />
          <Text variant="small">We only use your name, email address and profile photo from Google.</Text>
        </View>
      )}

      <View style={styles.footer}>
        <LogoMark size={22} />
        <Text variant="small">
          {SHOP_HOST} · app {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.resist },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48, gap: 18 },
  profile: { flexDirection: "row", alignItems: "center", gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.wash, paddingVertical: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  initial: { backgroundColor: colors.pit, alignItems: "center", justifyContent: "center" },
  initialText: { color: colors.starch, fontFamily: fonts.semibold, fontSize: 22 },
  flex: { flex: 1 },
  sameAccount: { color: colors.pit },
  ordersHeading: { marginTop: 10 },
  orders: { borderTopWidth: 1, borderTopColor: colors.wash },
  order: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.wash },
  pressed: { backgroundColor: colors.starch },
  reference: { fontFamily: fonts.semibold, fontSize: 16, color: colors.indigo, textDecorationLine: "underline" },
  signOut: { marginTop: 10 },
  signedOut: { gap: 16, marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, opacity: 0.85 },
});
