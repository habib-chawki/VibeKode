import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { betterAuth } from "better-auth";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { vi } from "vitest";

// Test-only: a migrated temp database behind lib/db.ts, plus Better Auth's test helpers
// on the same database. Call in beforeAll; modules that read the env must be imported
// dynamically afterwards. testUtils never enters the production auth config.
export async function setUpTestDatabase(): Promise<{
  helpers: TestHelpers;
  tearDown: () => void;
}> {
  const dir = mkdtempSync(join(tmpdir(), "todo-cat-test-"));
  vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

  const { db } = await import("./db");
  await migrate(db, { migrationsFolder: resolve("drizzle") });

  const { authDatabase, authOptions } = await import("./auth-options");
  const testAuth = betterAuth({
    ...authOptions,
    database: authDatabase(db),
    plugins: [...authOptions.plugins, testUtils()],
  });
  const helpers = (await testAuth.$context).test;

  return {
    helpers,
    tearDown: () => {
      db.$client.close();
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
