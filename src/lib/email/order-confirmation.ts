/**
 * The order confirmation email, as HTML (table layout and inline styles, so
 * it holds together in Gmail, Outlook and Apple Mail) plus a plain-text copy.
 * Pure function: no database or network, so it is easy to test.
 */
import { formatNaira } from "../money";
import { formatDate } from "../dates";
import { formatNigerianPhone } from "../phone";
import { DELIVERY_ZONES, isNigerianState, zoneForState } from "../shipping";
import { SHOP } from "../shop";
import type { OrderDetail } from "../orders";

export type EmailContext = {
  appUrl: string;
  supportEmail: string;
  bank: { bankName: string; accountName: string; accountNumber: string } | null;
  /** The shopper's own name from their Google account, if we have it. */
  accountName: string | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const C = {
  pit: "#141c45",
  faded: "#4d6299",
  wash: "#c7d1e8",
  resist: "#eef2f8",
  cloth: "#fbfcfe",
  starch: "#e4eaf5",
};
const FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function deliveryDays(state: string): string | null {
  return isNigerianState(state) ? DELIVERY_ZONES[zoneForState(state)].days : null;
}

export function renderOrderConfirmation(
  order: Pick<
    OrderDetail,
    | "reference"
    | "createdAt"
    | "customerName"
    | "phone"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "deliveryNotes"
    | "paymentMethod"
    | "subtotalKobo"
    | "deliveryKobo"
    | "totalKobo"
    | "items"
  >,
  ctx: EmailContext,
): RenderedEmail {
  const name = firstName(ctx.accountName) ?? firstName(order.customerName);
  const greeting = name ? `Thanks for your order, ${name}.` : "Thanks for your order.";
  const orderUrl = `${ctx.appUrl}/orders/${order.reference}`;
  const placed = formatDate(order.createdAt);
  const total = formatNaira(order.totalKobo);
  const days = deliveryDays(order.state);
  const bankTransfer = order.paymentMethod === "bank_transfer" && ctx.bank;
  const subject = `Your ${SHOP.name} order ${order.reference}`;
  const e = escapeHtml;

  /* ---------- plain text ---------- */
  const addressLines = [
    order.customerName,
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${order.state}`,
    formatNigerianPhone(order.phone),
  ].filter((line): line is string => Boolean(line));

  const textPayment = bankTransfer
    ? [
        "HOW TO PAY",
        `Transfer ${total} to:`,
        `  Bank: ${ctx.bank!.bankName}`,
        `  Account name: ${ctx.bank!.accountName}`,
        `  Account number: ${ctx.bank!.accountNumber}`,
        `Put ${order.reference} in the transfer narration so we can match your payment. We'll start packing as soon as it arrives.`,
      ]
    : ["HOW TO PAY", `Pay ${total} when your order arrives, in cash or by transfer to the rider.`];

  const text = [
    greeting,
    "",
    `We've received order ${order.reference} (placed ${placed}) and we're getting it ready.`,
    "",
    ...textPayment,
    "",
    "YOUR ORDER",
    ...order.items.map((item) => `${item.quantity} × ${item.productName}   ${formatNaira(item.lineTotalKobo)}`),
    "",
    `Subtotal   ${formatNaira(order.subtotalKobo)}`,
    `Delivery   ${order.deliveryKobo === 0 ? "Free" : formatNaira(order.deliveryKobo)}`,
    `Total      ${total}`,
    "",
    "DELIVERY TO",
    ...addressLines,
    ...(order.deliveryNotes ? [`Notes: ${order.deliveryNotes}`] : []),
    ...(days ? ["", `Delivery usually takes ${days}. We'll call before we set out.`] : []),
    "",
    `View your order: ${orderUrl}`,
    "",
    `Questions? Reply to this email or write to ${ctx.supportEmail}.`,
    "",
    SHOP.name,
  ].join("\n");

  /* ---------- HTML ---------- */
  const p = (content: string, extra = "") =>
    `<p style="margin:0 0 14px;font:16px/1.55 ${FONT};color:${C.pit};${extra}">${content}</p>`;

  const paymentHtml = bankTransfer
    ? `
      ${p(`<strong>How to pay:</strong> transfer <strong>${e(total)}</strong> to the account below.`, "margin-bottom:10px;")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="font:15px/1.6 ${FONT};color:${C.pit};margin:0 0 10px;">
        <tr><td style="padding:0 16px 0 0;color:${C.faded};">Bank</td><td><strong>${e(ctx.bank!.bankName)}</strong></td></tr>
        <tr><td style="padding:0 16px 0 0;color:${C.faded};">Account name</td><td><strong>${e(ctx.bank!.accountName)}</strong></td></tr>
        <tr><td style="padding:0 16px 0 0;color:${C.faded};">Account number</td><td><strong>${e(ctx.bank!.accountNumber)}</strong></td></tr>
      </table>
      ${p(`Put <strong>${e(order.reference)}</strong> in the transfer narration so we can match your payment. We'll start packing as soon as it arrives.`, "margin:0;")}`
    : p(`<strong>How to pay:</strong> pay <strong>${e(total)}</strong> when your order arrives, in cash or by transfer to the rider.`, "margin:0;");

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.wash};font:15px/1.45 ${FONT};color:${C.pit};">
            ${e(item.productName)}<br><span style="color:${C.faded};font-size:14px;">${item.quantity} × ${e(formatNaira(item.unitPriceKobo))}</span>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.wash};font:15px/1.45 ${FONT};color:${C.pit};white-space:nowrap;vertical-align:top;">${e(formatNaira(item.lineTotalKobo))}</td>
        </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string, strong = false) => `
        <tr>
          <td style="padding:4px 0;font:${strong ? "700 17px" : "15px"}/1.5 ${FONT};color:${C.pit};">${label}</td>
          <td align="right" style="padding:4px 0;font:${strong ? "700 17px" : "15px"}/1.5 ${FONT};color:${C.pit};white-space:nowrap;">${value}</td>
        </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.resist};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${e(order.reference)}: ${e(total)}. ${bankTransfer ? "Bank details inside." : "Pay on delivery."}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.resist};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.cloth};border:1px solid ${C.wash};">
        <tr>
          <td style="background:${C.pit};padding:22px 28px;font:700 22px/1 'Arial Narrow', ${FONT};letter-spacing:4px;text-transform:uppercase;color:${C.starch};">${e(SHOP.name)}</td>
        </tr>
        <tr>
          <td style="background:${C.pit};line-height:0;font-size:0;"><img src="${e(ctx.appUrl)}/email/adire-strip.png" width="600" height="50" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 10px;font:700 24px/1.3 ${FONT};color:${C.pit};">${e(greeting)}</h1>
            ${p(`We've received order <strong>${e(order.reference)}</strong>, placed ${e(placed)}, and we're getting it ready.`)}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 28px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:${C.resist};border-left:4px solid ${C.pit};padding:16px 18px;">${paymentHtml}</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 4px;">
            <h2 style="margin:0 0 4px;font:700 17px/1.4 ${FONT};color:${C.pit};">Your order</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              ${totalRow("Subtotal", e(formatNaira(order.subtotalKobo)))}
              ${totalRow("Delivery", order.deliveryKobo === 0 ? "Free" : e(formatNaira(order.deliveryKobo)))}
              ${totalRow("Total", e(total), true)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 8px;">
            <h2 style="margin:0 0 6px;font:700 17px/1.4 ${FONT};color:${C.pit};">Delivery to</h2>
            ${p(addressLines.map(e).join("<br>"), "margin-bottom:8px;")}
            ${order.deliveryNotes ? p(`<span style="color:${C.faded};">Notes:</span> ${e(order.deliveryNotes)}`, "margin-bottom:8px;") : ""}
            ${days ? p(`Delivery usually takes ${e(days)}. We'll call before we set out.`, `color:${C.faded};font-size:15px;`) : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="background:${C.pit};"><a href="${e(orderUrl)}" style="display:inline-block;padding:13px 22px;font:700 15px/1 ${FONT};color:${C.starch};text-decoration:none;">View your order</a></td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 22px;border-top:1px solid ${C.wash};font:13px/1.6 ${FONT};color:${C.faded};">
            Questions? Reply to this email or write to <a href="mailto:${e(ctx.supportEmail)}" style="color:${C.pit};">${e(ctx.supportEmail)}</a>.<br>
            ${e(SHOP.name)}: ${e(SHOP.description)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
