/** What the shop's API (/api/v1, see src/lib/api.ts in the website) sends back. */

export type Image = {
  /** Relative to the shop's address for generated swatches; a full URL for photos. */
  url: string;
  kind: "art" | "photo";
  description: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string;
  categoryLabel: string;
  technique: string;
  techniqueLabel: string;
  /** "Tied", "Stitched" or "Starch-painted". */
  techniqueShort: string;
  priceKobo: number;
  stock: number;
  maxQuantity: number;
  image: Image;
};

export type ProductDetail = Product & {
  description: string;
  details: { label: string; value: string }[];
  techniqueHow: string;
  related: Product[];
};

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  techniqueLabel: string;
  priceKobo: number;
  quantity: number;
  stock: number;
  lineTotalKobo: number;
  problem: "unavailable" | "sold-out" | "short" | null;
  problemText: string | null;
  canAddOne: boolean;
  image: Image;
};

export type Cart = {
  version: number;
  changedVia: "web" | "app" | null;
  itemCount: number;
  subtotalKobo: number;
  hasProblems: boolean;
  lines: CartLine[];
};

export type CartChangeResponse = {
  ok: boolean;
  message: string;
  cart: Cart;
  /** Only for signed-out shoppers: the guest cart to send back in X-Guest-Cart. */
  guestCartId?: string | null;
};

export type CartFeedResponse = { changed: true; cart: Cart } | { changed: false; version: number };

export type User = {
  id: string;
  email: string;
  name: string | null;
  firstName: string;
  avatarUrl: string | null;
};

export type DeliveryZoneKey = "lagos" | "south-west" | "rest-of-nigeria";

export type ShopInfo = {
  name: string;
  description: string;
  website: string;
  supportEmail: string | null;
  categories: { key: string; label: string }[];
  techniques: { key: string; label: string; short: string; how: string }[];
  states: { name: string; zone: DeliveryZoneKey }[];
  deliveryZones: { key: DeliveryZoneKey; label: string; feeKobo: number; days: string }[];
  freeDeliveryFromKobo: number;
  maxPerItem: number;
  bankTransfer: boolean;
};

export type CheckoutField = "fullName" | "phone" | "address1" | "address2" | "city" | "state" | "notes" | "paymentMethod";
export type PaymentMethod = "pay_on_delivery" | "bank_transfer";

export type CheckoutInfo = {
  contact: User;
  defaults: Partial<Record<CheckoutField, string>>;
  paymentMethods: { value: PaymentMethod; title: string; description: string }[];
  cart: Cart;
};

export type OrderSummary = {
  reference: string;
  createdAt: string;
  placedOn: string;
  status: string;
  statusLabel: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  totalKobo: number;
  itemCount: number;
};

export type Order = {
  reference: string;
  createdAt: string;
  placedAt: string;
  status: string;
  statusLabel: string;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  paymentStatus: string;
  paymentLabel: string;
  awaitingTransfer: boolean;
  bankTransfer: { bankName: string; accountName: string; accountNumber: string; narration: string } | null;
  email: string;
  customerName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  deliveryNotes: string | null;
  deliveryDays: string | null;
  subtotalKobo: number;
  deliveryKobo: number;
  totalKobo: number;
  items: {
    productSlug: string;
    productName: string;
    unitPriceKobo: number;
    quantity: number;
    lineTotalKobo: number;
    stillListed: boolean;
    image: Image;
  }[];
};
