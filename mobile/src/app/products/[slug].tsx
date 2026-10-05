import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import type { ProductDetail } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { useCart } from "@/state/cart";
import { Button } from "@/ui/button";
import { ErrorState, Loading, Notice } from "@/ui/feedback";
import { ProductCard, stockNote } from "@/ui/product-card";
import { Stepper } from "@/ui/stepper";
import { Swatch } from "@/ui/swatch";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: product, error, retry } = useResource(
    `product:${slug}`,
    async () => (await api.product(slug)).product,
    "Couldn't load this piece.",
  );

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!product) return <Loading label="Loading this piece" />;

  const note = stockNote(product.stock);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "" }} />
      <Swatch image={product.image} style={styles.image} described />
      <Text variant="small" style={styles.caption}>
        Every piece is dyed by hand, so yours will differ a little from this one.
      </Text>

      <View style={styles.body}>
        <Text variant="small" style={styles.kicker}>
          {product.categoryLabel} · {product.techniqueLabel}, {product.techniqueShort.toLowerCase()}
        </Text>
        <Text variant="display" style={styles.name}>
          {product.name}
        </Text>
        <Text variant="lead" style={styles.gap}>
          {product.summary}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatNaira(product.priceKobo)}</Text>
          {note ? <Text style={[styles.note, product.stock <= 0 && styles.soldOut]}>{note}</Text> : null}
        </View>

        {product.stock <= 0 ? (
          <View style={styles.gap}>
            <Notice>Sold out. We dye in small batches, so check back soon.</Notice>
          </View>
        ) : (
          <BuyBox key={product.id} product={product} />
        )}

        <Section title="About this piece">
          <Text>{product.description}</Text>
        </Section>

        <Section title={`How it's made: ${product.techniqueLabel}`}>
          <Text>{product.techniqueHow}</Text>
        </Section>

        {product.details.length > 0 ? (
          <Section title="Details">
            {product.details.map((detail) => (
              <View key={detail.label} style={styles.detail}>
                <Text variant="small" style={styles.detailLabel}>
                  {detail.label}
                </Text>
                <Text style={styles.detailValue}>{detail.value}</Text>
              </View>
            ))}
          </Section>
        ) : null}
      </View>

      {product.related.length > 0 ? (
        <View style={styles.related}>
          <Text variant="title" style={styles.relatedTitle}>
            You might also like
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
            {product.related.map((item) => (
              <ProductCard key={item.id} product={item} width={168} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Quantity, "Add to cart", and what the shop said. A new product starts afresh. */
function BuyBox({ product }: { product: ProductDetail }) {
  const { cart, add, pending } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; message: string; at: number } | null>(null);
  const inCart = cart?.lines.find((line) => line.productId === product.id)?.quantity ?? 0;

  const addToCart = async () => {
    const outcome = await add(product.id, quantity);
    setResult({ ...outcome, at: Date.now() });
    if (outcome.ok) setQuantity(1);
  };

  return (
    <View style={styles.buy}>
      <View style={styles.buyRow}>
        <Stepper
          value={quantity}
          itemName={product.name}
          canDecrease={quantity > 1}
          canIncrease={quantity < product.maxQuantity}
          onDecrease={() => setQuantity((n) => Math.max(1, n - 1))}
          onIncrease={() => setQuantity((n) => Math.min(product.maxQuantity, n + 1))}
        />
        <Button
          title="Add to cart"
          loadingTitle="Adding…"
          loading={pending.has(product.id)}
          onPress={addToCart}
          style={styles.addButton}
          testID="add-to-cart"
        />
      </View>
      <View accessibilityLiveRegion="polite" style={styles.status}>
        {result ? (
          <Text key={result.at} style={result.ok ? styles.added : styles.refused} accessibilityRole={result.ok ? undefined : "alert"}>
            {result.message}{" "}
            {result.ok ? (
              <Link href="/cart" style={styles.inlineLink}>
                View cart
              </Link>
            ) : null}
          </Text>
        ) : inCart > 0 ? (
          <Text variant="small">You have {inCart} in your cart.</Text>
        ) : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.resist },
  content: { paddingBottom: 48 },
  image: { width: "100%", aspectRatio: 1 },
  caption: { paddingHorizontal: GUTTER, marginTop: 8 },
  body: { paddingHorizontal: GUTTER, paddingTop: 18 },
  kicker: { fontFamily: fonts.semibold },
  name: { marginTop: 6 },
  gap: { marginTop: 12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 14, marginTop: 14 },
  price: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  note: { fontFamily: fonts.semibold, fontSize: 15, color: colors.pit },
  soldOut: { color: colors.alert },
  buy: { marginTop: 18 },
  buyRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  addButton: { flex: 1 },
  status: { minHeight: 28, marginTop: 10 },
  added: { fontFamily: fonts.semibold },
  refused: { fontFamily: fonts.semibold, color: colors.alert },
  inlineLink: { color: colors.indigo, textDecorationLine: "underline", fontFamily: fonts.semibold },
  section: { marginTop: 26, borderTopWidth: 1, borderTopColor: colors.wash, paddingTop: 18 },
  sectionBody: { marginTop: 8, gap: 6 },
  detail: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  detailLabel: { width: 96, fontFamily: fonts.semibold },
  detailValue: { flex: 1 },
  related: { marginTop: 36 },
  relatedTitle: { paddingHorizontal: GUTTER },
  relatedRow: { gap: 14, paddingHorizontal: GUTTER, paddingTop: 14 },
});
