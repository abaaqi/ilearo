import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, renderOrderConfirmation, type EmailContext } from "@/lib/email/order-confirmation";
import { sendWithMailgun } from "@/lib/email/mailgun";
import { connectionSettings, sanitizeDatabaseUrl } from "@/lib/db-url";
import { seedFromString, toArtSpec } from "@/components/adire/art";

const order = {
  reference: "IA-7K3M9Q",
  createdAt: new Date("2026-10-01T09:14:00Z"),
  customerName: 'Ngozi "Zee" <script>alert(1)</script> Okafor',
  phone: "+2348031234567",
  addressLine1: "14 Adeola Odeku Street",
  addressLine2: "Flat 3 & 4, Glover Court",
  city: "Victoria Island",
  state: "Lagos",
  deliveryNotes: "Call at the gate <b>please</b>",
  paymentMethod: "bank_transfer" as const,
  subtotalKobo: 7_350_000,
  deliveryKobo: 250_000,
  totalKobo: 7_600_000,
  items: [
    {
      productSlug: "ibadandun-panel-cloth",
      productName: "Ibadandun panel cloth",
      unitPriceKobo: 3_200_000,
      quantity: 2,
      lineTotalKobo: 6_400_000,
      art: toArtSpec({}, 1),
      imageUrl: null,
      stillListed: true,
    },
    {
      productSlug: "oniko-bucket-hat",
      productName: "Oniko bucket hat",
      unitPriceKobo: 950_000,
      quantity: 1,
      lineTotalKobo: 950_000,
      art: toArtSpec({}, 2),
      imageUrl: null,
      stillListed: true,
    },
  ],
};

const ctx: EmailContext = {
  appUrl: "https://shop.example",
  supportEmail: "hello@shop.example",
  bank: { bankName: "Example Bank", accountName: "Ile Aro Ltd", accountNumber: "0123456789" },
  accountName: "Ngozi Okafor",
};

describe("order confirmation email", () => {
  it("has a clear subject and greets the shopper by first name", () => {
    const email = renderOrderConfirmation(order, ctx);
    expect(email.subject).toBe("Your Ile Aro order IA-7K3M9Q");
    expect(email.text.startsWith("Thanks for your order, Ngozi.")).toBe(true);
    expect(email.html).toContain("Thanks for your order, Ngozi.");
  });

  it("includes bank details and the reference for transfers", () => {
    const { html, text } = renderOrderConfirmation(order, ctx);
    for (const body of [html, text]) {
      expect(body).toContain("0123456789");
      expect(body).toContain("Ile Aro Ltd");
      expect(body).toContain("₦76,000");
      expect(body).toContain("IA-7K3M9Q");
    }
    expect(text).toContain("2 × Ibadandun panel cloth   ₦64,000");
    expect(html).toContain('href="https://shop.example/orders/IA-7K3M9Q"');
  });

  it("tells pay-on-delivery shoppers to pay the rider", () => {
    const { text } = renderOrderConfirmation({ ...order, paymentMethod: "pay_on_delivery" }, ctx);
    expect(text).toContain("Pay ₦76,000 when your order arrives");
    expect(text).not.toContain("Account number");
  });

  it("escapes everything the shopper typed", () => {
    const { html } = renderOrderConfirmation(order, { ...ctx, accountName: null });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>please</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;please&lt;/b&gt;");
    expect(html).toContain("Flat 3 &amp; 4");
    expect(html).toContain("Ngozi &quot;Zee&quot;");
  });

  it("works without a support address", () => {
    const { text, html } = renderOrderConfirmation(order, { ...ctx, supportEmail: null });
    expect(text).toContain("Questions? Just reply to this email.");
    expect(html).toContain("Questions? Just reply to this email.");
    expect(html).not.toContain("mailto:");
  });

  it("shows free delivery as free", () => {
    const { text } = renderOrderConfirmation({ ...order, deliveryKobo: 0, totalKobo: order.subtotalKobo }, ctx);
    expect(text).toContain("Delivery   Free");
  });

  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("sendWithMailgun", () => {
  afterEach(() => vi.unstubAllGlobals());

  const email = { to: "ngozi@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", replyTo: "hello@shop.example", tag: "order-confirmation", variables: { order_reference: "IA-7K3M9Q" } };
  const config = { apiKey: "key-123", domain: "mg.shop.example", from: "Ile Aro <orders@mg.shop.example>", baseUrl: "https://api.eu.mailgun.net" };

  it("skips sending when Mailgun isn't configured", async () => {
    expect(await sendWithMailgun(email, null)).toMatchObject({ status: "skipped" });
  });

  it("posts the message with HTTP Basic auth", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "<abc@mg.shop.example>", message: "Queued. Thank you." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendWithMailgun(email, config)).toEqual({ status: "sent", providerMessageId: "<abc@mg.shop.example>" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.eu.mailgun.net/v3/mg.shop.example/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("api:key-123").toString("base64")}`);
    const body = init.body as URLSearchParams;
    expect(body.get("from")).toBe(config.from);
    expect(body.get("to")).toBe("ngozi@example.com");
    expect(body.get("h:Reply-To")).toBe("hello@shop.example");
    expect(body.get("o:tag")).toBe("order-confirmation");
    expect(body.get("v:order_reference")).toBe("IA-7K3M9Q");
  });

  it("reports Mailgun's error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"Invalid private key"}', { status: 401 })));
    const result = await sendWithMailgun(email, config);
    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.error).toContain("401");
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await sendWithMailgun(email, config)).toMatchObject({ status: "failed" });
  });
});

describe("database URLs", () => {
  it("drops Neon's client-only parameters but keeps sslmode", () => {
    const raw = "postgresql://u:p%40ss@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    expect(sanitizeDatabaseUrl(raw)).toBe("postgresql://u:p%40ss@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require");
    expect(connectionSettings(raw).ssl).toBeUndefined();
  });

  it("requires TLS for Supabase's pooler and strips Prisma options", () => {
    const raw = "postgresql://postgres.abcd:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";
    const settings = connectionSettings(raw);
    expect(settings.url).toBe("postgresql://postgres.abcd:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres");
    expect(settings.ssl).toBe("require");
  });

  it("doesn't use TLS for a local database", () => {
    expect(connectionSettings("postgresql://postgres:postgres@localhost:5432/ile_aro").ssl).toBe(false);
    expect(connectionSettings("postgres://postgres@127.0.0.1/ile_aro").ssl).toBe(false);
  });

  it("keeps startup options Postgres understands", () => {
    expect(sanitizeDatabaseUrl("postgres://h/db?options=-c%20search_path%3Dshop&foo=bar")).toBe("postgres://h/db?options=-c+search_path%3Dshop");
  });
});

describe("product art settings", () => {
  it("falls back to safe defaults for unexpected data", () => {
    expect(toArtSpec(null, 7)).toEqual({ pattern: "moons", seed: 7, tone: "deep" });
    expect(toArtSpec({ pattern: "plaid", tone: "neon", seed: "x" }, 9)).toEqual({ pattern: "moons", seed: 9, tone: "deep" });
    expect(toArtSpec({ pattern: "waves", tone: "light", seed: 3 }, 9)).toEqual({ pattern: "waves", seed: 3, tone: "light" });
  });

  it("seeds from text deterministically", () => {
    expect(seedFromString("market-tote")).toBe(seedFromString("market-tote"));
    expect(seedFromString("market-tote")).not.toBe(seedFromString("weekend-tote"));
  });
});
