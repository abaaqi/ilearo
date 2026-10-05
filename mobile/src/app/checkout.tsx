import { router } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ApiError, api } from "@/lib/api";
import { formatNaira } from "@/lib/money";
import type { Cart, CheckoutField, CheckoutInfo, PaymentMethod, ShopInfo } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { useCart } from "@/state/cart";
import { useSession } from "@/state/session";
import { useShop } from "@/state/shop";
import { Button } from "@/ui/button";
import { ErrorState, Loading, Notice } from "@/ui/feedback";
import { Field, Picker } from "@/ui/form";
import { Swatch } from "@/ui/swatch";
import { Text } from "@/ui/text";
import { colors, fonts, GUTTER } from "@/ui/theme";

type Values = Record<CheckoutField, string>;

const EMPTY: Values = {
  fullName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  notes: "",
  paymentMethod: "pay_on_delivery",
};

/** The same delivery quote the website shows (the server works out the real one when the order is placed). */
function deliveryQuote(shop: ShopInfo | null, state: string, subtotalKobo: number) {
  const zoneKey = shop?.states.find((s) => s.name === state)?.zone;
  const zone = shop?.deliveryZones.find((z) => z.key === zoneKey);
  if (!shop || !zone) return null;
  const free = subtotalKobo >= shop.freeDeliveryFromKobo;
  return { feeKobo: free ? 0 : zone.feeKobo, days: zone.days, free };
}

export default function CheckoutScreen() {
  const { status, user, signIn, signingIn } = useSession();
  const { cart: liveCart } = useCart();
  const { data: info, error, retry } = useResource(
    status === "signedIn" && user ? `checkout:${user.id}` : null,
    () => api.checkout(),
    "Couldn't load checkout.",
  );

  if (status !== "signedIn") {
    return (
      <View style={styles.padded}>
        <Text variant="title">Sign in to check out</Text>
        <Text style={styles.gap}>
          Use the Google account you use on the Ile Aro website. Your cart and orders are shared between the two.
        </Text>
        <Button title="Continue with Google" onPress={() => void signIn()} loading={signingIn} loadingTitle="Signing in…" style={styles.gap} />
      </View>
    );
  }
  if (error && !info) return <ErrorState message={error} onRetry={retry} />;
  if (!info) return <Loading label="Loading checkout" />;

  if (info.cart.lines.length === 0) {
    return (
      <View style={styles.padded}>
        <Text variant="lead">Your cart is empty, so there&apos;s nothing to check out yet.</Text>
        <Button title="Browse the shop" onPress={() => router.navigate("/")} style={styles.gap} />
      </View>
    );
  }
  if (info.cart.hasProblems) {
    return (
      <View style={styles.padded}>
        <Text variant="lead">
          Some pieces in your cart have sold out or run low since you added them. Update your cart, then come back to check out.
        </Text>
        <Button title="Review your cart" onPress={() => router.navigate("/cart")} style={styles.gap} />
      </View>
    );
  }
  // Follow the live cart, so a piece added on the website meanwhile shows up here (and in the
  // total) at once. Once the order is placed the cart empties; keep showing what was ordered.
  const cart = liveCart && liveCart.lines.length > 0 ? liveCart : info.cart;
  return <CheckoutForm info={info} cart={cart} onCartChanged={retry} />;
}

/** Starts from the delivery details of the shopper's last order, wherever they placed it. */
function initialValues(info: CheckoutInfo): Values {
  const values = { ...EMPTY };
  for (const [field, value] of Object.entries(info.defaults)) {
    if (value) values[field as CheckoutField] = value;
  }
  return values;
}

function CheckoutForm({ info, cart, onCartChanged }: { info: CheckoutInfo; cart: Cart; onCartChanged: () => void }) {
  const { shop, error: shopError, retry: retryShop } = useShop();
  const { reload: reloadCart, placeOrder } = useCart();
  const [values, setValues] = useState<Values>(() => initialValues(info));
  const [errors, setErrors] = useState<Partial<Values>>({});
  const [banner, setBanner] = useState<{ message: string; cartLink: boolean } | null>(null);
  const [placing, setPlacing] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const headerHeight = useHeaderHeight();
  const { contact, paymentMethods } = info;

  const quote = deliveryQuote(shop, values.state, cart.subtotalKobo);
  const total = cart.subtotalKobo + (quote?.feeKobo ?? 0);
  const set = (field: CheckoutField) => (text: string) => setValues((current) => ({ ...current, [field]: text }));

  const place = async () => {
    setPlacing(true);
    setErrors({});
    setBanner(null);
    try {
      const { reference } = await placeOrder(values);
      router.replace({ pathname: "/orders/[reference]", params: { reference, placed: "1" } });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setBanner({ message: err.message, cartLink: err.cartChanged });
        if (err.cartChanged) {
          void reloadCart();
          onCartChanged();
        }
      } else {
        setBanner({ message: "We couldn't place your order just now. Please try again.", cartLink: false });
      }
      scroll.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setPlacing(false);
    }
  };

  return (
    // "padding" on both platforms: Android apps are edge-to-edge now, so the window no longer shrinks for the keyboard.
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {banner ? (
          <Notice tone="error" title={banner.message}>
            {Object.values(errors).length > 0 ? (
              <View style={styles.errorList}>
                {Object.values(errors).map((message) => (
                  <Text key={message}>• {message}</Text>
                ))}
              </View>
            ) : null}
            {banner.cartLink ? <Button variant="link" title="Go to your cart" onPress={() => router.navigate("/cart")} /> : null}
          </Notice>
        ) : null}

        <View style={styles.section}>
          <Text variant="heading">Contact</Text>
          <Text style={styles.small}>
            Signed in as <Text variant="strong">{contact.name ?? contact.email}</Text>
            {contact.name ? ` (${contact.email})` : ""}. We&apos;ll email your order confirmation there.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="heading">Delivery</Text>
          <Field
            label="Full name"
            hint="The person we hand the parcel to."
            value={values.fullName}
            onChangeText={set("fullName")}
            error={errors.fullName}
            autoComplete="name"
            textContentType="name"
            maxLength={100}
          />
          <Field
            label="Phone number"
            hint="We call this number before we deliver."
            value={values.phone}
            onChangeText={set("phone")}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
          />
          <Field
            label="Street address"
            value={values.address1}
            onChangeText={set("address1")}
            error={errors.address1}
            autoComplete="address-line1"
            textContentType="streetAddressLine1"
            maxLength={200}
          />
          <Field
            label="Apartment, estate or landmark"
            optional
            value={values.address2}
            onChangeText={set("address2")}
            error={errors.address2}
            autoComplete="address-line2"
            textContentType="streetAddressLine2"
            maxLength={200}
          />
          <Field
            label="Town or city"
            value={values.city}
            onChangeText={set("city")}
            error={errors.city}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            maxLength={80}
          />
          {!shop && shopError ? (
            <Notice tone="error" title="Couldn't load the delivery options">
              <Button variant="link" title="Try again" onPress={retryShop} />
            </Notice>
          ) : null}
          <Picker
            label="State"
            value={values.state}
            placeholder="Choose a state"
            options={(shop?.states ?? []).map((state) => ({ value: state.name, label: state.name }))}
            onChange={set("state")}
            error={errors.state}
          />
          <Text variant="small" accessibilityLiveRegion="polite">
            {quote
              ? quote.free
                ? `Free delivery to ${values.state}, usually ${quote.days}.`
                : `Delivery to ${values.state}: ${formatNaira(quote.feeKobo)}, usually ${quote.days}.`
              : "Delivery costs depend on the state."}
          </Text>
          <Field
            label="Delivery notes"
            optional
            hint="Gate codes, a landmark, or the best time to reach you."
            value={values.notes}
            onChangeText={set("notes")}
            error={errors.notes}
            multiline
            maxLength={500}
          />
        </View>

        <View style={styles.section} accessibilityRole="radiogroup" accessibilityLabel="Payment">
          <Text variant="heading">Payment</Text>
          {errors.paymentMethod ? <Text style={styles.fieldError}>{errors.paymentMethod}</Text> : null}
          {paymentMethods.map((method) => (
            <PaymentOption
              key={method.value}
              title={method.title}
              description={method.description}
              selected={values.paymentMethod === method.value}
              onSelect={() => setValues((current) => ({ ...current, paymentMethod: method.value as PaymentMethod }))}
            />
          ))}
        </View>

        <View style={[styles.section, styles.summary]}>
          <Text variant="heading">Your order</Text>
          {cart.lines.map((line) => (
            <View key={line.productId} style={styles.summaryLine}>
              <Swatch image={line.image} style={styles.thumb} />
              <View style={styles.flex}>
                <Text style={styles.small}>{line.name}</Text>
                <Text variant="small">Quantity {line.quantity}</Text>
              </View>
              <Text variant="strong">{formatNaira(line.lineTotalKobo)}</Text>
            </View>
          ))}
          <View style={styles.totals}>
            <Row label="Subtotal" value={formatNaira(cart.subtotalKobo)} />
            <Row label="Delivery" value={quote ? (quote.free ? "Free" : formatNaira(quote.feeKobo)) : "Choose a state"} />
            <Row label="Total" value={formatNaira(total)} strong />
          </View>
        </View>

        <Button
          title={`Place order for ${formatNaira(total)}`}
          loading={placing}
          loadingTitle="Placing your order…"
          onPress={() => void place()}
          style={styles.place}
          testID="place-order"
        />
        {!quote ? <Text variant="small">The total includes delivery once you choose a state.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PaymentOption({ title, description, selected, onSelect }: { title: string; description: string; selected: boolean; onSelect: () => void }) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.flex}>
        <Text variant="strong">{title}</Text>
        <Text variant="small">{description}</Text>
      </View>
    </Pressable>
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
  screen: { flex: 1, backgroundColor: colors.resist },
  content: { padding: GUTTER, paddingBottom: 56, gap: 26 },
  padded: { flex: 1, padding: GUTTER, paddingTop: 28, backgroundColor: colors.resist },
  gap: { marginTop: 16 },
  section: { gap: 14 },
  small: { fontSize: 15, lineHeight: 22 },
  errorList: { marginTop: 6, gap: 2 },
  fieldError: { fontFamily: fonts.semibold, color: colors.alert },
  option: { flexDirection: "row", gap: 12, padding: 14, borderWidth: 2, borderColor: colors.wash, backgroundColor: colors.cloth },
  optionSelected: { borderColor: colors.pit },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, marginTop: 2, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: colors.pit },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pit },
  flex: { flex: 1 },
  summary: { backgroundColor: colors.cloth, borderWidth: 1, borderColor: colors.wash, padding: 16, gap: 10 },
  summaryLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 52 },
  totals: { borderTopWidth: 1, borderTopColor: colors.wash, paddingTop: 10, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.wash, paddingTop: 8, marginTop: 2 },
  totalText: { fontFamily: fonts.bold, fontSize: 18 },
  place: { marginTop: 4 },
});
