// @vitest-environment node
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

// Loaded after setUpTestDatabase, because lib/db.ts and lib/auth.ts read the env on import.
let auth: typeof import("./auth").auth;
let getUserId: typeof import("./session").getUserId;
let helpers: TestHelpers;
let tearDown: () => void;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  ({ auth } = await import("./auth"));
  ({ getUserId } = await import("./session"));
});

afterAll(() => tearDown?.());

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
