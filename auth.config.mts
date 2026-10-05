// Config for the Better Auth CLI only (`npm run auth:generate`). The CLI can't load
// lib/auth.ts, which imports server-only, so this uses a Drizzle mock instead of lib/db.ts.
import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/libsql";
import { authDatabase, authOptions } from "./lib/auth-options";

export const auth = betterAuth({
  ...authOptions,
  database: authDatabase(drizzle.mock()),
});
