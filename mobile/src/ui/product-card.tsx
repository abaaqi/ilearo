import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { formatNaira } from "@/lib/money";
import type { Product } from "@/lib/types";
import { Swatch } from "./swatch";
import { Text } from "./text";
import { colors, fonts } from "./theme";

export function stockNote(stock: number): string | null {
  if (stock <= 0) return "Sold out";
  if (stock <= 3) return `Only ${stock} left`;
  return null;
}

export function ProductCard({ product, width }: { product: Product; width: number }) {
  const note = stockNote(product.stock);
  const price = formatNaira(product.priceKobo);
  return (
    <Link href={{ pathname: "/products/[slug]", params: { slug: product.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${product.name}, ${price}${note ? `, ${note}` : ""}`}
        style={({ pressed }) => [{ width }, pressed && styles.pressed]}
        testID={`product-${product.slug}`}
      >
        <View>
          <Swatch image={product.image} style={{ width, height: width }} recyclingKey={product.id} />
          {product.stock <= 0 ? (
            <View style={styles.soldOut}>
              <Text variant="label" style={styles.soldOutText}>
                Sold out
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="strong" style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text variant="strong" style={styles.price}>
          {price}
        </Text>
        <Text variant="small" numberOfLines={1}>
          {product.techniqueLabel}, {product.techniqueShort.toLowerCase()}
          {note && product.stock > 0 ? <Text variant="small" style={styles.low}>{`  ${note}`}</Text> : null}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  name: { marginTop: 10, lineHeight: 21 },
  price: { marginTop: 2, fontFamily: fonts.bold },
  low: { color: colors.pit, fontFamily: fonts.semibold },
  soldOut: { position: "absolute", left: 10, top: 10, backgroundColor: colors.resist, paddingHorizontal: 9, paddingVertical: 3 },
  soldOutText: { fontSize: 13 },
});
