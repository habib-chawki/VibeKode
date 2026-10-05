// @vitest-environment node
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

let helpers: TestHelpers;
let tearDown: () => void;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
});

afterAll(() => tearDown?.());

const now = new Date("2026-10-05T12:00:00.000Z");
const withoutIds = <T extends { id: string }>(todos: T[]) =>
  todos.map(({ id: _id, ...rest }) => rest);

test("running the seed twice gives the same state and leaves other users alone", async () => {
  const { seedDemo, DEMO_USER } = await import("./seed-demo");
  const { addTodo, listTodos } = await import("./todo-service");
  const { auth } = await import("./auth");
  const { db } = await import("./db");
  const { user } = await import("./auth-schema");

  const other = await helpers.saveUser(helpers.createUser());
  const othersTodo = await addTodo(other.id, { title: "Not the demo's" });

  const first = await seedDemo({ now });
  const second = await seedDemo({ now });

  expect(second.userId).toBe(first.userId);
  expect(withoutIds(second.todos)).toEqual(withoutIds(first.todos));
  expect(first.todos).toHaveLength(12);
  expect(first.todos.filter((t) => t.done)).toHaveLength(4);
  expect(first.todos.some((t) => t.dueDate === "2026-10-05")).toBe(true);
  const created = first.todos.map((t) => Date.parse(t.createdAt));
  expect(Math.min(...created)).toBeGreaterThanOrEqual(
    now.getTime() - 14 * 24 * 60 * 60 * 1000,
  );

  const demoUsers = (await db.select().from(user)).filter(
    (u) => u.email === DEMO_USER.email,
  );
  expect(demoUsers).toHaveLength(1);

  const signIn = await auth.api.signInEmail({
    body: { email: DEMO_USER.email, password: DEMO_USER.password },
  });
  expect(signIn.user.id).toBe(first.userId);

  expect(await listTodos(other.id, { status: "all" })).toEqual([othersTodo]);
});
