import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base, testDir: ".",
  testMatch: ["tasteBridge.browser.spec.ts", "whatIf.browser.spec.ts", "debate.browser.spec.ts"],
  outputDir: "../../generated-artifacts/experiences-integration-tests",
});
