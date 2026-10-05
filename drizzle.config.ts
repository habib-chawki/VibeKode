import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Like Next.js, never override a DATABASE_URL that is already set (tests, e2e).
if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set: cp .env.example .env");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
