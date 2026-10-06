import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

// The tests check for OPENROUTER_API_KEY; like Next.js, never override what's already set.
if (existsSync(".env")) process.loadEnvFile(".env");

// `npm run test:chat`: the model-calling e2e tests, same server setup as playwright.config.mts.
export default defineConfig({
  ...base,
  testDir: "./e2e-llm",
  timeout: 120_000,
});
