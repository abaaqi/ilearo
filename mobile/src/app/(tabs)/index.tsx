import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { plural } from "@/lib/money";
import { useResource } from "@/lib/use-resource";
import { useShop } from "@/state/shop";
import { ErrorState, Loading } from "@/ui/feedback";
import { LogoMark } from "@/ui/logo-mark";
import { ProductCard } from "@/ui/product-card";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

const GAP = 14;
const MAX_WIDTH = 900;

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { shop } = useShop();
  const [category, setCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: products,
    error,
    retry,
    refresh: reload,
  } = useResource(`products:${category ?? "all"}`, async () => (await api.products({ category })).products, "Couldn't load the shop.");

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const columns = width >= 700 ? 3 : 2;
  const contentWidth = Math.min(width, MAX_WIDTH) - GUTTER * 2;
  const cardWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns);
  const title = category ? (shop?.categories.find((c) => c.key === category)?.label ?? "Shop") : "All adire";

  const header = (
    <View>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <LogoMark size={34} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Ile Aro
        </Text>
      </View>

      <View style={styles.hero}>
        <Text variant="display" style={styles.heroTitle}>
          Adire, dyed by hand in Abeokuta
        </Text>
        <Text style={styles.heroText}>
          Tied, stitched and starch-painted cotton in deep indigo. Sold by the length, and made up into scarves, bags and pieces
          for the home.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityLabel="Type"
      >
        {[{ key: null, label: "All" }, ...(shop?.categories ?? [])].map((option) => {
          const active = option.key === category;
          return (
            <Pressable
              key={option.label}
              onPress={() => setCategory(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.listHeading}>
        <Text variant="title">{title}</Text>
        {products ? <Text variant="small">{plural(products.length, "piece")}</Text> : null}
      </View>
    </View>
  );

  return (
    <FlatList
      key={columns}
      data={products ?? []}
      numColumns={columns}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : products ? (
          <Text style={styles.empty}>Nothing here at the moment. Try another type.</Text>
        ) : (
          <Loading label="Loading the shop" />
        )
      }
      columnWrapperStyle={[styles.row, { width: Math.min(width, MAX_WIDTH) }]}
      contentContainerStyle={styles.list}
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pit} colors={[colors.pit]} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.resist },
  list: { paddingBottom: 40, gap: 26 },
  row: { gap: GAP, paddingHorizontal: GUTTER, alignSelf: "center" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: GUTTER, paddingBottom: 12 },
  wordmark: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: 1.5, color: colors.pit },
  hero: { backgroundColor: colors.pit, marginHorizontal: 6, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 24 },
  heroTitle: { color: colors.starch, fontSize: 46, lineHeight: 45 },
  heroText: { color: colors.starch, marginTop: 14, fontSize: 16, lineHeight: 24, opacity: 0.92 },
  chips: { gap: 8, paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 4 },
  chip: { minHeight: 40, paddingHorizontal: 15, justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.pit, borderColor: colors.pit },
  chipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.pit },
  chipTextActive: { color: colors.starch },
  listHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: GUTTER, paddingTop: 20 },
  empty: { paddingHorizontal: GUTTER },
});
