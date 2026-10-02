import "server-only";

/**
 * Settings read from environment variables at request time.
 * See .env.example for what each one does.
 */

const trimmed = (value: string | undefined) => {
  const v = value?.trim();
  return v ? v : undefined;
};

/** The site's public address, e.g. https://ilearo.com (no trailing slash). */
export function appUrl(): string {
  const explicit = trimmed(process.env.APP_URL);
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = trimmed(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Cookies are marked Secure whenever the site is served over HTTPS. */
export function usesHttps(): boolean {
  return appUrl().startsWith("https://");
}

export type GoogleSettings = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function googleSettings(): GoogleSettings | null {
  const clientId = trimmed(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = trimmed(process.env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${appUrl()}/api/auth/google/callback` };
}

export type MailgunSettings = {
  apiKey: string;
  domain: string;
  from: string;
  /** https://api.mailgun.net or https://api.eu.mailgun.net */
  baseUrl: string;
};

export function mailgunSettings(): MailgunSettings | null {
  const apiKey = trimmed(process.env.MAILGUN_API_KEY);
  const domain = trimmed(process.env.MAILGUN_DOMAIN);
  if (!apiKey || !domain) return null;
  const region = (trimmed(process.env.MAILGUN_REGION) ?? "us").toLowerCase();
  const baseUrl =
    trimmed(process.env.MAILGUN_API_BASE)?.replace(/\/+$/, "") ??
    (region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net");
  const from = trimmed(process.env.MAILGUN_FROM) ?? `Ile Aro <orders@${domain}>`;
  return { apiKey, domain, from, baseUrl };
}

export type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

/** Bank transfer is offered at checkout only when all three are set. */
export function bankDetails(): BankDetails | null {
  const bankName = trimmed(process.env.BANK_NAME);
  const accountName = trimmed(process.env.BANK_ACCOUNT_NAME);
  const accountNumber = trimmed(process.env.BANK_ACCOUNT_NUMBER);
  if (!bankName || !accountName || !accountNumber) return null;
  return { bankName, accountName, accountNumber };
}

export function supportEmail(): string {
  return trimmed(process.env.SHOP_SUPPORT_EMAIL) ?? "hello@example.com";
}
