import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests with the browser really offline (spec §16.7). Local only: needs the local
 * Supabase stack (`npm run db:start`) and a production build (`npm run build`); the service worker
 * only runs in production builds. Run with `npm run test:e2e`.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
