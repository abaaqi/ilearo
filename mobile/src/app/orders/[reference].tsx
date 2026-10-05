import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/state/session";
import { Button } from "@/ui/button";
import { ErrorState, Loading } from "@/ui/feedback";
import { Swatch } from "@/ui/swatch";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

export default function OrderScreen() {
  const { reference, placed } = useLocalSearchParams<{ reference: string; placed?: string }>();
  const { user } = useSession();
  const { data: order, error, retry } = useResource(
    `order:${reference}`,
    async () => (await api.order(reference)).order,
    "Couldn't load this order.",
  );

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!order) return <Loading label="Loading your order" />;

  const justPlaced = placed === "1";
  const firstName = user?.firstName ?? order.customerName.trim().split(/\s+/)[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {justPlaced ? (
        <View>
          <Text variant="display">Thank you, {firstName}</Text>
          <Text variant="lead" style={styles.gap}>
            Order <Text style={styles.bold}>{order.reference}</Text> is placed. A confirmation is on its way to{" "}
            <Text style={styles.bold}>{order.email}</Text>.
          </Text>
        </View>
      ) : (
        <View>
          <Text variant="display">Order {order.reference}</Text>
          <Text variant="lead" style={styles.gap}>
            Placed {order.placedAt}
          </Text>
        </View>
      )}

      <View style={styles.payBox}>
        <Text variant="heading">{order.bankTransfer ? "How to pay" : "Payment"}</Text>
        {order.bankTransfer ? (
          <>
            <Text style={styles.gapSmall}>
              Transfer <Text style={styles.bold}>{formatNaira(order.totalKobo)}</Text> to:
            </Text>
            <Detail label="Bank" value={order.bankTransfer.bankName} />
            <Detail label="Account name" value={order.bankTransfer.accountName} />
            <Detail label="Account number" value={order.bankTransfer.accountNumber} />
            <Detail label="Narration" value={order.bankTransfer.narration} />
            <Text variant="small" style={styles.gapSmall}>
              We&apos;ll start packing as soon as your transfer arrives.
            </Text>
          </>
        ) : order.awaitingTransfer ? (
          <Text style={styles.gapSmall}>
            We&apos;ll email you our account details for a transfer of <Text style={styles.bold}>{formatNaira(order.totalKobo)}</Text>.
          </Text>
        ) : order.paymentStatus === "unpaid" ? (
          <Text style={styles.gapSmall}>
            Pay <Text style={styles.bold}>{formatNaira(order.totalKobo)}</Text> when your order arrives, in cash or by transfer to the
            rider.
          </Text>
        ) : (
          <Text style={styles.gapSmall}>{order.paymentLabel}.</Text>
        )}
      </View>

      <View>
        <Text variant="heading">What you ordered</Text>
        <View style={styles.items}>
          {order.items.map((item) => (
            <View key={item.productSlug} style={styles.item}>
              <Swatch image={item.image} style={styles.thumb} />
              <View style={styles.flex}>
                <Text variant="strong">{item.productName}</Text>
                <Text variant="small">
                  {item.quantity} × {formatNaira(item.unitPriceKobo)}
                </Text>
              </View>
              <Text variant="strong">{formatNaira(item.lineTotalKobo)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totals}>
          <Row label="Subtotal" value={formatNaira(order.subtotalKobo)} />
          <Row label="Delivery" value={order.deliveryKobo === 0 ? "Free" : formatNaira(order.deliveryKobo)} />
          <Row label="Total" value={formatNaira(order.totalKobo)} strong />
        </View>
      </View>

      <View style={styles.panel}>
        <Text variant="heading">Status</Text>
        <Detail label="Order" value={order.statusLabel} />
        <Detail label="Payment" value={order.paymentLabel} />
        <Detail label="Method" value={order.paymentMethodLabel} />

        <Text variant="heading" style={styles.gapLarge}>
          Delivery to
        </Text>
        <Text style={styles.gapSmall}>
          {[order.customerName, order.addressLine1, order.addressLine2, `${order.city}, ${order.state}`, order.phone]
            .filter(Boolean)
            .join("\n")}
        </Text>
        {order.deliveryNotes ? <Text variant="small">Notes: {order.deliveryNotes}</Text> : null}
        {order.deliveryDays ? (
          <Text variant="small" style={styles.gapSmall}>
            Usually arrives in {order.deliveryDays}. We&apos;ll call before we set out.
          </Text>
        ) : null}
      </View>

      <View style={styles.buttons}>
        <Button title="Keep shopping" onPress={() => router.navigate("/")} />
        <Button title="All your orders" variant="outline" onPress={() => router.navigate("/account")} />
      </View>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="small" style={styles.detailLabel}>
        {label}
      </Text>
      <Text style={[styles.flex, styles.bold]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.row, strong && styles.totalRow]}>
      <Text style={strong ? styles.totalText : undefined}>{label}</Text>
      <Text style={strong ? styles.totalText : undefined}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.resist },
  content: { padding: GUTTER, paddingBottom: 56, gap: 28 },
  gap: { marginTop: 12 },
  gapSmall: { marginTop: 6 },
  gapLarge: { marginTop: 20 },
  bold: { fontFamily: fonts.semibold },
  payBox: { borderLeftWidth: 4, borderLeftColor: colors.pit, backgroundColor: colors.cloth, paddingHorizontal: 18, paddingVertical: 16 },
  items: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.wash },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.wash },
  thumb: { width: 60, height: 60 },
  flex: { flex: 1 },
  totals: { marginTop: 12, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.wash, paddingTop: 8 },
  totalText: { fontFamily: fonts.bold, fontSize: 18 },
  panel: { borderWidth: 1, borderColor: colors.wash, backgroundColor: colors.cloth, padding: 18 },
  detail: { flexDirection: "row", gap: 12, marginTop: 6 },
  detailLabel: { width: 118 },
  buttons: { gap: 12 },
});
