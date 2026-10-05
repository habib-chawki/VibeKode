// @vitest-environment node
import { CurrentUserSchema, ErrorBodySchema } from "@todo-cat/contract";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { setUpTestDatabase } from "@/lib/test-support";

let GET: typeof import("./route").GET;
let helpers: TestHelpers;
let tearDown: () => void;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  ({ GET } = await import("./route"));
});

afterAll(() => tearDown?.());

const me = (headers?: HeadersInit) =>
  GET(new Request("http://localhost:3000/api/me", { headers }));

test("401 without a token and with an invalid one", async () => {
  for (const response of [
    await me(),
    await me({ authorization: "Bearer nope" }),
  ]) {
    expect(response.status).toBe(401);
    expect(ErrorBodySchema.parse(await response.json()).error.code).toBe(
      "unauthorized",
    );
  }
});

test("returns the bearer token's user", async () => {
  const user = await helpers.saveUser(
    helpers.createUser({ name: "Me", email: "me@example.com" }),
  );
  const { token } = await helpers.login({ userId: user.id });
  const response = await me({ authorization: `Bearer ${token}` });
  expect(response.status).toBe(200);
  expect(CurrentUserSchema.parse(await response.json())).toEqual({
    id: user.id,
    name: "Me",
    email: "me@example.com",
  });
});
