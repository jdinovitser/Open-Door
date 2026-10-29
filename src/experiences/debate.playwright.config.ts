import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

export default defineConfig({ ...base, testDir: ".", testMatch: "debate.browser.spec.ts", outputDir: "../../generated-artifacts/debate-browser-tests" });
