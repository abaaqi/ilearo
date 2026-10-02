/**
 * Sends email through Mailgun's HTTP API:
 * POST {base}/v3/{domain}/messages with HTTP Basic auth ("api" : key).
 * https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages
 */
export type MailgunConfig = {
  apiKey: string;
  domain: string;
  from: string;
  baseUrl: string;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Shows up in Mailgun's logs and analytics. */
  tag?: string;
  /** Attached to the message as Mailgun user variables (v:name). */
  variables?: Record<string, string>;
};

export type SendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "failed"; error: string }
  | { status: "skipped"; error: string };

export async function sendWithMailgun(email: OutgoingEmail, config: MailgunConfig | null): Promise<SendResult> {
  if (!config) {
    return { status: "skipped", error: "Mailgun is not configured (set MAILGUN_API_KEY and MAILGUN_DOMAIN)." };
  }

  const body = new URLSearchParams();
  body.set("from", config.from);
  body.set("to", email.to);
  body.set("subject", email.subject);
  body.set("text", email.text);
  body.set("html", email.html);
  if (email.replyTo) body.set("h:Reply-To", email.replyTo);
  if (email.tag) body.append("o:tag", email.tag);
  for (const [name, value] of Object.entries(email.variables ?? {})) body.set(`v:${name}`, value);

  const auth = Buffer.from(`api:${config.apiKey}`).toString("base64");
  try {
    const response = await fetch(`${config.baseUrl}/v3/${encodeURIComponent(config.domain)}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    if (!response.ok) {
      return { status: "failed", error: `Mailgun answered ${response.status}: ${text.slice(0, 500)}` };
    }
    let id = "";
    try {
      id = String((JSON.parse(text) as { id?: unknown }).id ?? "");
    } catch {
      // Mailgun always answers JSON; keep going if it ever doesn't.
    }
    return { status: "sent", providerMessageId: id };
  } catch (error) {
    return { status: "failed", error: `Could not reach Mailgun: ${(error as Error).message}` };
  }
}
