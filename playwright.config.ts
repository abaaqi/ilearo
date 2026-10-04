import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the production build against a throwaway Postgres
 * database and local stand-ins for Google and Mailgun (tests/e2e/mock-services.mjs).
 *
 *   npm run test:e2e
 *
 * Needs a Postgres server; set TEST_DATABASE_URL if it isn't the default below.
 * The database named in the URL is created if missing and wiped on every run.
 */
const PORT = 3100;
/** A second copy of the app with no DATABASE_URL, for the "misconfigured host" tests. */
const BROKEN_PORT = 3101;
const MOCK_PORT = 4011;
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/ile_aro_test";
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// DATABASE_URL and MAILGUN_FROM are wrapped in quotes on purpose: hosting dashboards
// keep quotes pasted from a .env file, and the app has to cope with that.
const appEnv = {
  DATABASE_URL: `"${TEST_DATABASE_URL}"`,
  APP_URL: `http://localhost:${PORT}`,
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_OAUTH_MOCK_URL: MOCK_URL,
  MAILGUN_API_KEY: "test-mailgun-key",
  MAILGUN_DOMAIN: "mg.ilearo.test",
  MAILGUN_FROM: '"Ile Aro <orders@mg.ilearo.test>"',
  MAILGUN_REGION: "us",
  MAILGUN_API_BASE: MOCK_URL,
  SHOP_SUPPORT_EMAIL: "hello@ilearo.test",
  BANK_NAME: "Example Bank",
  BANK_ACCOUNT_NAME: "Ile Aro Ltd",
  BANK_ACCOUNT_NUMBER: "0123456789",
};

export default defineConfig({
  testDir: "tests/e2e",
  // Tests share one database, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-services.mjs",
      url: `${MOCK_URL}/__test/health`,
      env: { MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
    },
    {
      // Uses the existing production build: `npm run test:e2e` builds first.
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/signin`,
      env: appEnv,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // An empty value counts as missing, and stops Next.js reading one from .env.local.
      command: `npx next start -p ${BROKEN_PORT}`,
      url: `http://localhost:${BROKEN_PORT}/signin`,
      env: { ...appEnv, APP_URL: `http://localhost:${BROKEN_PORT}`, DATABASE_URL: "" },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
