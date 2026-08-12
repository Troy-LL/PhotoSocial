import { defineConfig, devices } from "@playwright/test";

const cameraLaunch = {
  permissions: ["camera"] as const,
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
};

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
    {
      name: "chromium",
      testIgnore: [
        /solo-booth\.spec\.ts/,
        /strip-quality-audit\.spec\.ts/,
        /party-booth\.spec\.ts/,
      ],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        ...cameraLaunch,
      },
    },
    {
      name: "tablet",
      testMatch: /viewport-preview\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        isMobile: false,
        deviceScaleFactor: 2,
        ...cameraLaunch,
      },
    },
    {
      name: "mobile",
      testIgnore: [
        /solo-booth\.spec\.ts/,
        /strip-quality-audit\.spec\.ts/,
        /party-booth\.spec\.ts/,
      ],
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 },
        ...cameraLaunch,
      },
    },
    {
      name: "solo-mobile",
      testMatch: [
        /solo-booth\.spec\.ts/,
        /strip-quality-audit\.spec\.ts/,
        /party-booth\.spec\.ts/,
      ],
      use: {
        ...devices["Pixel 7"],
        ...cameraLaunch,
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
