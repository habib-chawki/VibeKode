import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import * as authSchema from "./auth-schema";

// Shared by the app (lib/auth.ts), the schema CLI (auth.config.mts) and tests.
// No server-only import here and no database of its own, so the CLI can load it.
export const authOptions = {
  emailAndPassword: { enabled: true },
  plugins: [
    // The REST API and the CLI send `Authorization: Bearer <session token>`.
    bearer(),
    // The CLI logs in like `gh auth login`; the /device page comes later.
    deviceAuthorization({ verificationUri: "/device" }),
  ],
} satisfies BetterAuthOptions;

// The relations-v2 adapter matches Drizzle v1 and makes the CLI emit v2 relations.
export function authDatabase(db: Parameters<typeof drizzleAdapter>[0]) {
  return drizzleAdapter(db, { provider: "sqlite", schema: authSchema });
}
