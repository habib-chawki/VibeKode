// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-db-test-"));

beforeAll(() => {
  // lib/db.ts reads DATABASE_URL on import, so set it before the dynamic import.
  vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

test("lib/db.ts migrates a fresh database and runs queries", async () => {
  const { db } = await import("./db");
  await migrate(db, { migrationsFolder: resolve("drizzle") });

  const tables = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table'`,
  );
  expect(tables.map((t) => t.name)).toContain("__drizzle_migrations");

  const [row] = await db.all<{ one: number }>(sql`select 1 as one`);
  expect(row.one).toBe(1);

  db.$client.close();
});
