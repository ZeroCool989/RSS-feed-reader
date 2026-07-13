import { defineConfig } from "@playwright/test";

/**
 * E2E suite. Uses the locally installed Chrome (`channel: "chrome"`) so no
 * browser download is needed. Run `npm run build` first — the suite starts
 * the production server itself.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 4,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  use: {
    baseURL: "http://localhost:3199",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 950 },
  },
  webServer: {
    command: "npm run start -- -p 3199",
    url: "http://localhost:3199",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
