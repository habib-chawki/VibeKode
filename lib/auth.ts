import "server-only";
import { betterAuth } from "better-auth";
import { authDatabase, authOptions } from "./auth-options";
import { db } from "./db";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the environment (.env).
export const auth = betterAuth({
  ...authOptions,
  database: authDatabase(db),
});
