import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "solo-mobile",
      testMatch: /solo-booth\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        permissions: ["camera"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command:
        "npx pnpm@9.15.0 --filter @photosocial/shared build && npx pnpm@9.15.0 --filter @photosocial/party dev",
      stdout: /PartyKit/i,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        JWT_SECRET: "test-secret",
        PARTYKIT_BROADCAST_SECRET: "dev-party-broadcast-secret",
      },
    },
    {
      command: "npx pnpm@9.15.0 --filter @photosocial/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        VITE_PARTYKIT_HOST: "127.0.0.1:1999",
      },
    },
  ],
});
