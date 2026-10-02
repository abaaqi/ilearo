import { expect, type Page } from "@playwright/test";

export const MOCK_URL = "http://localhost:4011";

export type SentEmail = {
  id: string;
  domain: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo: string | null;
  tags: string[];
  variables: Record<string, string>;
};

async function post(path: string) {
  const response = await fetch(`${MOCK_URL}${path}`, { method: "POST" });
  if (!response.ok) throw new Error(`Mock ${path} answered ${response.status}`);
}

export const resetMocks = () => post("/__test/reset");
export const failNextEmails = (count = 1) => post(`/__test/mailgun-fail?count=${count}`);
export const breakNextIdToken = (mode: "wrong-audience" | "wrong-nonce" | "expired" | "wrong-issuer") =>
  post(`/__test/token-fault?mode=${mode}`);

export async function sentEmails(): Promise<SentEmail[]> {
  return (await fetch(`${MOCK_URL}/__test/emails`)).json() as Promise<SentEmail[]>;
}

/** Waits for the confirmation email, which is sent just after the order page responds. */
export async function waitForEmails(count: number): Promise<SentEmail[]> {
  await expect.poll(async () => (await sentEmails()).length, { timeout: 10_000 }).toBe(count);
  return sentEmails();
}

export const ACCOUNTS = {
  amina: { name: "Amina Bello", email: "amina.bello@example.com" },
  tunde: { name: "Tunde Adeyemi", email: "tunde.adeyemi@example.com" },
  unverified: { name: "New Shopper", email: "new.shopper@example.com" },
} as const;

/** Clicks through the stand-in Google account chooser. Call when on the sign-in page. */
export async function chooseGoogleAccount(page: Page, account: keyof typeof ACCOUNTS) {
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.waitForURL(`${MOCK_URL}/authorize**`);
  await page.getByRole("link", { name: ACCOUNTS[account].name }).click();
}

export async function signIn(page: Page, account: keyof typeof ACCOUNTS, returnTo = "/account") {
  await page.goto(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
  await chooseGoogleAccount(page, account);
  await page.waitForURL((url) => url.pathname === returnTo.split("?")[0]);
}
