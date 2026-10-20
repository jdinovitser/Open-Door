import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "generated-artifacts/browser-tests",
  reporter: "list",
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000"),
    viewport: { width: 1280, height: 900 },
    launchOptions: existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {},
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
