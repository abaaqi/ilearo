import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth/session";
import type { CheckoutInput, CheckoutValues, PaymentMethod } from "./checkout-schema";
import { lineProblem, type CartProblem } from "./cart";
import { deliveryQuote, isNigerianState } from "./shipping";
import { generateOrderReference, isOrderReference } from "./reference";
import { formatNigerianPhone } from "./phone";
import { seedFromString, toArtSpec, type ArtSpec } from "@/components/adire/art";

export type OrderStatus = "placed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type StockProblem = { name: string; problem: CartProblem; available: number; requested: number };

export type PlaceOrderResult =
  | { ok: true; orderId: string; reference: string }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "stock"; problems: StockProblem[] };

type LockedLine = {
  productId: string;
  slug: string;
  name: string;
  priceKobo: number;
  stock: number;
  active: boolean;
  quantity: number;
};

/**
 * Turns the shopper's cart into an order in one transaction.
 *
 * Prices and stock come from the database, never from the form. The cart row
 * and the product rows are locked (`for update`) so two checkouts can't sell
 * the same last item, and a double-submitted form finds an empty cart the
 * second time round.
 */
export async function placeOrder(user: SessionUser, input: CheckoutInput): Promise<PlaceOrderResult> {
  return db().begin(async (sql): Promise<PlaceOrderResult> => {
    const [cart] = await sql<{ id: string }[]>`select id from carts where user_id = ${user.id} for update`;
    if (!cart) return { ok: false, reason: "empty" };

    // Lock products in id order so concurrent checkouts can't deadlock.
    const lines = await sql<LockedLine[]>`
      select p.id as product_id, p.slug, p.name, p.price_kobo, p.stock, p.active, ci.quantity
      from cart_items ci
      join products p on p.id = ci.product_id
      where ci.cart_id = ${cart.id}
      order by p.id
      for update of p
    `;
    if (lines.length === 0) return { ok: false, reason: "empty" };

    const problems: StockProblem[] = [];
    for (const line of lines) {
      const problem = lineProblem(line);
      if (problem) problems.push({ name: line.name, problem, available: line.stock, requested: line.quantity });
    }
    if (problems.length > 0) return { ok: false, reason: "stock", problems };

    const subtotalKobo = lines.reduce((sum, line) => sum + line.priceKobo * line.quantity, 0);
    const delivery = deliveryQuote(input.state, subtotalKobo);
    const order = {
      userId: user.id,
      email: user.email,
      customerName: input.fullName,
      phone: input.phone,
      addressLine1: input.address1,
      addressLine2: input.address2,
      city: input.city,
      state: input.state,
      deliveryNotes: input.notes,
      paymentMethod: input.paymentMethod,
      subtotalKobo,
      deliveryKobo: delivery.feeKobo,
      totalKobo: subtotalKobo + delivery.feeKobo,
    };

    // References are random; on the rare clash, draw again.
    let created: { id: string; reference: string } | undefined;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      [created] = await sql<{ id: string; reference: string }[]>`
        insert into orders ${sql({ ...order, reference: generateOrderReference() })}
        on conflict (reference) do nothing
        returning id, reference
      `;
    }
    if (!created) throw new Error("Could not allocate an order reference");
    const orderId = created.id;

    await sql`
      insert into order_items ${sql(
        lines.map((line) => ({
          orderId,
          productId: line.productId,
          productSlug: line.slug,
          productName: line.name,
          unitPriceKobo: line.priceKobo,
          quantity: line.quantity,
          lineTotalKobo: line.priceKobo * line.quantity,
        })),
      )}
    `;

    for (const line of lines) {
      await sql`
        update products set stock = stock - ${line.quantity}, updated_at = now()
        where id = ${line.productId}
      `;
    }

    await sql`delete from cart_items where cart_id = ${cart.id}`;
    await sql`update carts set updated_at = now() where id = ${cart.id}`;

    return { ok: true, orderId, reference: created.reference };
  });
}

export type OrderItem = {
  productSlug: string;
  productName: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
  art: ArtSpec;
  imageUrl: string | null;
  /** False once the product has been taken off the shop. */
  stillListed: boolean;
};

export type OrderDetail = {
  id: string;
  reference: string;
  email: string;
  customerName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  deliveryNotes: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotalKobo: number;
  deliveryKobo: number;
  totalKobo: number;
  createdAt: Date;
  confirmationEmailSentAt: Date | null;
  items: OrderItem[];
};

type OrderRow = Omit<OrderDetail, "items">;
type ItemRow = Omit<OrderItem, "art" | "stillListed"> & { art: unknown; active: boolean | null };

async function withItems(order: OrderRow): Promise<OrderDetail> {
  const sql = db();
  const rows = await sql<ItemRow[]>`
    select oi.product_slug, oi.product_name, oi.unit_price_kobo, oi.quantity, oi.line_total_kobo,
           p.art, p.image_url, p.active
    from order_items oi
    left join products p on p.id = oi.product_id
    where oi.order_id = ${order.id}
    order by oi.product_name
  `;
  return {
    ...order,
    items: rows.map(({ art, active, ...row }) => ({
      ...row,
      art: toArtSpec(art, seedFromString(row.productSlug)),
      stillListed: active === true,
    })),
  };
}

const orderColumns = (sql: ReturnType<typeof db>) => sql`
  id, reference, email, customer_name, phone, address_line1, address_line2, city, state,
  delivery_notes, payment_method, payment_status, status, subtotal_kobo, delivery_kobo,
  total_kobo, created_at, confirmation_email_sent_at
`;

/** An order, only if it belongs to this user. */
export async function getOrderForUser(reference: string, userId: string): Promise<OrderDetail | null> {
  if (!isOrderReference(reference)) return null;
  const sql = db();
  const [order] = await sql<OrderRow[]>`
    select ${orderColumns(sql)} from orders where reference = ${reference} and user_id = ${userId}
  `;
  return order ? withItems(order) : null;
}

/** For background jobs such as sending the confirmation email. */
export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const sql = db();
  const [order] = await sql<OrderRow[]>`select ${orderColumns(sql)} from orders where id = ${id}`;
  return order ? withItems(order) : null;
}

export type OrderSummary = {
  reference: string;
  createdAt: Date;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalKobo: number;
  itemCount: number;
};

export async function listOrdersForUser(userId: string): Promise<OrderSummary[]> {
  const sql = db();
  return sql<OrderSummary[]>`
    select o.reference, o.created_at, o.status, o.payment_method, o.payment_status, o.total_kobo,
           (select coalesce(sum(quantity), 0)::int from order_items where order_id = o.id) as item_count
    from orders o
    where o.user_id = ${userId}
    order by o.created_at desc
    limit 100
  `;
}

/** Prefills checkout with the delivery details from the shopper's last order. */
export async function lastDeliveryDetails(userId: string): Promise<CheckoutValues | null> {
  const sql = db();
  const [row] = await sql<
    { customerName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; state: string }[]
  >`
    select customer_name, phone, address_line1, address_line2, city, state
    from orders where user_id = ${userId}
    order by created_at desc limit 1
  `;
  if (!row) return null;
  return {
    fullName: row.customerName,
    phone: formatNigerianPhone(row.phone),
    address1: row.addressLine1,
    address2: row.addressLine2 ?? "",
    city: row.city,
    state: isNigerianState(row.state) ? row.state : "",
  };
}

/**
 * The reference of an order this user placed in the last few minutes, if any.
 * Used when a checkout form is submitted twice: the second submission finds
 * an empty cart and is sent to the order the first one created.
 */
export async function recentOrderReference(userId: string, withinSeconds = 300): Promise<string | null> {
  const sql = db();
  const [row] = await sql<{ reference: string }[]>`
    select reference from orders
    where user_id = ${userId} and created_at > now() - make_interval(secs => ${withinSeconds})
    order by created_at desc limit 1
  `;
  return row?.reference ?? null;
}

/** Records that the confirmation email went out. */
export async function markConfirmationSent(orderId: string): Promise<void> {
  const sql = db();
  await sql`update orders set confirmation_email_sent_at = now(), updated_at = now() where id = ${orderId}`;
}
