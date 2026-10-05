import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHOP_HOST } from "@/lib/config";
import { formatNaira, plural } from "@/lib/money";
import type { CartLine } from "@/lib/types";
import { useCart, type LiveStatus } from "@/state/cart";
import { useSession } from "@/state/session";
import { useShop } from "@/state/shop";
import { Button } from "@/ui/button";
import { ErrorState, Loading, Notice } from "@/ui/feedback";
import { Stepper } from "@/ui/stepper";
import { Swatch } from "@/ui/swatch";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { cart, loading, error, live, pending, setQuantity, remove, reload } = useCart();
  const { status, signIn, signingIn, signInMessage } = useSession();
  const { shop } = useShop();
  const [refreshing, setRefreshing] = useState(false);
  const [lineMessage, setLineMessage] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const run = async (change: Promise<{ ok: boolean; message: string }>) => {
    const outcome = await change;
    setLineMessage(outcome.ok ? null : outcome.message);
  };

  const checkOut = async () => {
    if (status === "signedIn") return router.push("/checkout");
    if (await signIn()) router.push("/checkout");
  };

  const content = () => {
    if (loading && !cart) return <Loading label="Loading your cart" />;
    if (error && !cart) return <ErrorState message={error} onRetry={() => void reload()} />;
    if (!cart || cart.lines.length === 0) {
      return (
        <View style={styles.empty}>
          <Text variant="lead">Your cart is empty.</Text>
          <Button title="Browse the shop" onPress={() => router.navigate("/")} style={styles.emptyButton} />
        </View>
      );
    }

    const freeFrom = shop?.freeDeliveryFromKobo ?? 0;
    const toFree = freeFrom - cart.subtotalKobo;
    return (
      <>
        {lineMessage ? (
          <View style={styles.lineMessage}>
            <Notice tone="error">{lineMessage}</Notice>
          </View>
        ) : null}
        <View style={styles.lines}>
          {cart.lines.map((line) => (
            <Line
              key={line.productId}
              line={line}
              busy={pending.has(line.productId)}
              onChange={(quantity) => void run(setQuantity(line.productId, quantity))}
              onRemove={() => void run(remove(line.productId))}
            />
          ))}
        </View>

        <View style={styles.summary} accessibilityLabel="Summary">
          <Text variant="heading">Summary</Text>
          <View style={styles.summaryRow}>
            <Text>Subtotal ({plural(cart.itemCount, "item")})</Text>
            <Text variant="strong">{formatNaira(cart.subtotalKobo)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="small">Delivery</Text>
            <Text variant="small">Worked out at checkout</Text>
          </View>
          {shop ? (
            <Text variant="small" style={styles.nudge}>
              {toFree > 0 ? `Add ${formatNaira(toFree)} more for free delivery.` : "Your order qualifies for free delivery."}
            </Text>
          ) : null}
          {cart.hasProblems ? (
            <Text style={styles.problem}>Fix the items marked above to check out.</Text>
          ) : null}
          <Button
            title={status === "signedIn" ? "Check out" : "Sign in to check out"}
            onPress={() => void checkOut()}
            disabled={cart.hasProblems}
            loading={signingIn}
            loadingTitle="Signing in…"
            style={styles.checkout}
            testID="check-out"
          />
          {signInMessage && status !== "signedIn" ? <Text style={styles.problem}>{signInMessage}</Text> : null}
          <Link href="/" style={styles.keepShopping}>
            Keep shopping
          </Link>
        </View>
      </>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pit} colors={[colors.pit]} />}
    >
      <Text variant="display">Your cart</Text>
      <LiveLine signedIn={status === "signedIn"} live={live} onSignIn={() => void signIn()} signingIn={signingIn} />
      {content()}
    </ScrollView>
  );
}

/** Says whether this cart is in step with the website right now. */
function LiveLine({ signedIn, live, onSignIn, signingIn }: { signedIn: boolean; live: LiveStatus; onSignIn: () => void; signingIn: boolean }) {
  if (!signedIn) {
    return (
      <View style={styles.liveBox}>
        <Text variant="small">Sign in to share this cart with the website, on any device.</Text>
        <Button variant="link" title={signingIn ? "Signing in…" : "Sign in with Google"} onPress={onSignIn} disabled={signingIn} />
      </View>
    );
  }
  const words: Record<LiveStatus, string> = {
    live: `Live with ${SHOP_HOST}. Changes made on the website show up here straight away.`,
    connecting: "Connecting to the shop…",
    offline: "Can't reach the shop. Changes from the website will appear when you're back online.",
    off: "",
  };
  return (
    <View style={[styles.liveBox, styles.liveRow]} accessibilityLiveRegion="polite" testID="live-status">
      <View style={[styles.dot, live === "live" ? styles.dotLive : live === "offline" ? styles.dotOffline : styles.dotWaiting]} />
      <Text variant="small" style={styles.liveText}>
        {words[live]}
      </Text>
    </View>
  );
}

function Line({ line, busy, onChange, onRemove }: { line: CartLine; busy: boolean; onChange: (quantity: number) => void; onRemove: () => void }) {
  return (
    <View style={styles.line} testID={`cart-line-${line.slug}`}>
      <Link href={{ pathname: "/products/[slug]", params: { slug: line.slug } }} asChild>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Swatch image={line.image} style={styles.thumb} recyclingKey={line.productId} />
        </Pressable>
      </Link>
      <View style={styles.lineBody}>
        <View style={styles.lineTop}>
          <Link href={{ pathname: "/products/[slug]", params: { slug: line.slug } }} style={styles.lineName}>
            {line.name}
          </Link>
          <Text variant="strong">{formatNaira(line.lineTotalKobo)}</Text>
        </View>
        <Text variant="small">
          {line.techniqueLabel}, {formatNaira(line.priceKobo)} each
        </Text>
        {line.problemText ? <Text style={styles.problem}>{line.problemText}</Text> : null}
        <View style={styles.lineControls}>
          <Stepper
            value={line.quantity}
            itemName={line.name}
            canDecrease={line.quantity > 0}
            canIncrease={line.canAddOne}
            onDecrease={() => onChange(line.quantity - 1)}
            onIncrease={() => onChange(line.quantity + 1)}
            disabled={busy}
          />
          <Button variant="link" title="Remove" accessibilityLabel={`Remove ${line.name}`} onPress={onRemove} disabled={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.resist },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  empty: { marginTop: 18, alignItems: "flex-start" },
  emptyButton: { marginTop: 18 },
  liveBox: { marginTop: 10 },
  liveRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  liveText: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotLive: { backgroundColor: colors.indigo },
  dotWaiting: { backgroundColor: colors.wash },
  dotOffline: { backgroundColor: colors.alert },
  lineMessage: { marginTop: 16 },
  lines: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.wash },
  line: { flexDirection: "row", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.wash },
  thumb: { width: 84, height: 84 },
  lineBody: { flex: 1, gap: 2 },
  lineTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "flex-start" },
  lineName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.pit },
  lineControls: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" },
  problem: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.alert, marginTop: 4 },
  summary: { marginTop: 22, backgroundColor: colors.cloth, borderWidth: 1, borderColor: colors.wash, padding: 18, gap: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  nudge: { color: colors.pit },
  checkout: { marginTop: 10 },
  keepShopping: { alignSelf: "center", marginTop: 8, padding: 8, color: colors.indigo, textDecorationLine: "underline", fontFamily: fonts.semibold, fontSize: 15 },
});
