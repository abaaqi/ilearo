/**
 * Builds the mobile app for a browser, pointed at the test address that
 * tests/e2e/app-web-server.mjs serves (the API is passed through to the
 * website on :3100). Used by `npm run test:app`.
 *
 *   node scripts/build-app-web.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "mobile");
const result = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist-web", "--clear"], {
  cwd: mobile,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, EXPO_PUBLIC_SHOP_URL: "http://localhost:3200", EXPO_OFFLINE: "1", CI: "1" },
});
process.exit(result.status ?? 1);
