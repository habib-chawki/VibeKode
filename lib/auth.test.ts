// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { betterAuth } from "better-auth";
import { type TestHelpers, testUtils } from "better-auth/plugins";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "todo-cat-auth-test-"));

// Loaded after the env stubs, because lib/db.ts and lib/auth.ts read them on import.
let auth: typeof import("./auth").auth;
let getUserId: typeof import("./session").getUserId;
let helpers: TestHelpers;
let closeDb: () => void;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", `file:${join(dir, "test.db")}`);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters-long");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

  const { db } = await import("./db");
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  closeDb = () => db.$client.close();

  ({ auth } = await import("./auth"));
  ({ getUserId } = await import("./session"));

  // testUtils stays out of the production config: a test-only instance on the same database.
  const { authDatabase, authOptions } = await import("./auth-options");
  const testAuth = betterAuth({
    ...authOptions,
    database: authDatabase(db),
    plugins: [...authOptions.plugins, testUtils()],
  });
  helpers = (await testAuth.$context).test;
});

afterAll(() => {
  closeDb?.();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const credentials = {
  name: "Lissie's Human",
  email: "human@example.com",
  password: "correct horse battery",
};

describe("email and password", () => {
  test("sign-up creates the user and a session", async () => {
    const result = await auth.api.signUpEmail({ body: credentials });
    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toBeTruthy();
  });

  test("the right password signs in", async () => {
    const result = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
    });
    expect(result.user.email).toBe(credentials.email);
    expect(result.token).toBeTruthy();
  });

  test("a wrong password is rejected", async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: credentials.email, password: "wrong password!" },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });
});

describe("getUserId", () => {
  test("returns the user id for a session cookie", async () => {
    const user = await helpers.saveUser(helpers.createUser());
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    expect(headers.get("cookie")).toBeTruthy();
    expect(await getUserId(headers)).toBe(user.id);
  });

  test("returns the user id for a bearer token", async () => {
    const user = await helpers.saveUser(helpers.createUser());
    const { token } = await helpers.login({ userId: user.id });
    const request = new Request("http://localhost:3000/api/todos", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await getUserId(request)).toBe(user.id);
  });

  test("returns null without a cookie or a token", async () => {
    expect(await getUserId(new Headers())).toBeNull();
    const forged = new Headers({ authorization: "Bearer not-a-real-token" });
    expect(await getUserId(forged)).toBeNull();
  });
});
