import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { authRelations } from "./auth-schema";

// The only module that opens the database. Next.js loads DATABASE_URL from .env;
// tests and the e2e server set it to a temp file before this module loads.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set: cp .env.example .env");
}

export const db = drizzle({ connection: { url }, relations: authRelations });
