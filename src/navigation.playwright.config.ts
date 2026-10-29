import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

// Keep this focused suite within the delegated src directory.
export default defineConfig({
  ...base,
  testDir: "./tests/browser",
  outputDir: "../generated-artifacts/browser-tests/navigation",
});
