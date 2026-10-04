import "server-only";
import { db } from "../db";
import { appUrl, bankDetails, mailgunSettings, supportEmail } from "../env";
import { getOrderById, markConfirmationSent } from "../orders";
import { renderOrderConfirmation } from "./order-confirmation";
import { sendWithMailgun, type SendResult } from "./mailgun";

/**
 * Emails the order confirmation and records the attempt in email_log.
 * Runs after the order is committed and never throws: a failed email must
 * not undo or block a placed order.
 */
export async function sendOrderConfirmation(orderId: string): Promise<SendResult | null> {
  try {
    const order = await getOrderById(orderId);
    if (!order) return null;

    const sql = db();
    const [account] = await sql<{ name: string | null }[]>`
      select u.name from orders o join users u on u.id = o.user_id where o.id = ${orderId}
    `;

    const contact = supportEmail();
    const message = renderOrderConfirmation(order, {
      appUrl: appUrl(),
      supportEmail: contact,
      bank: bankDetails(),
      accountName: account?.name ?? null,
    });

    const result = await sendWithMailgun(
      {
        to: order.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: contact ?? undefined,
        tag: "order-confirmation",
        variables: { order_reference: order.reference },
      },
      mailgunSettings(),
    );

    if (result.status === "skipped") {
      // Handy in development: read the email in the terminal instead.
      if (process.env.NODE_ENV !== "production") {
        console.info(`[email] Mailgun isn't configured, so here is the confirmation for ${order.reference}:\n\n${message.text}\n`);
      } else {
        console.warn(`[email] Mailgun isn't configured; no confirmation sent for ${order.reference}.`);
      }
    } else if (result.status === "failed") {
      console.error(`[email] Confirmation for ${order.reference} failed: ${result.error}`);
    }

    await sql`
      insert into email_log ${sql({
        orderId,
        kind: "order_confirmation",
        toEmail: order.email,
        subject: message.subject,
        status: result.status,
        providerMessageId: result.status === "sent" ? result.providerMessageId : null,
        error: result.status === "sent" ? null : result.error,
      })}
    `;
    if (result.status === "sent") await markConfirmationSent(orderId);
    return result;
  } catch (error) {
    console.error("[email] Could not send the order confirmation:", error);
    return null;
  }
}
