import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({
  ...base, testDir: ".", testMatch: "whatIf.browser.spec.ts",
  outputDir: "../../generated-artifacts/what-if-browser-tests",
});
