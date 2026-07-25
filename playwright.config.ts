import { defineConfig } from "@playwright/test";

/**
 * E2E smokes run against the production build (`pnpm build` first — CI does
 * this in a prior step; locally reuse a running `pnpm start`).
 * WebGL in headless environments renders via SwiftShader (launch args).
 * PW_CHROMIUM_PATH overrides the browser binary (pre-provisioned runners).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    launchOptions: {
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    viewport: { width: 1600, height: 900 },
  },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
