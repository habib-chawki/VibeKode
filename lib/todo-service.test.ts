// @vitest-environment node
import { TodoProgressSchema, TodoSchema } from "@todo-cat/contract";
import type { TestHelpers } from "better-auth/plugins";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { setUpTestDatabase } from "./test-support";

type Service = typeof import("./todo-service");

let service: Service;
let helpers: TestHelpers;
let tearDown: () => void;
let alice: string;
let bob: string;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  service = await import("./todo-service");
});

afterAll(() => tearDown?.());

// Fresh users per test: every test starts with two empty lists.
beforeEach(async () => {
  alice = (await helpers.saveUser(helpers.createUser({ name: "Alice" }))).id;
  bob = (await helpers.saveUser(helpers.createUser({ name: "Bob" }))).id;
});

const at = (iso: string) => ({ now: new Date(iso) });

async function expectNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    name: "TodoError",
    code: "todo-not-found",
    message: "Todo not found.",
  });
}

describe("per-user isolation", () => {
  test("list never shows another user's todos", async () => {
    await service.addTodo(alice, { title: "Alice's secret" });
    const bobs = await service.addTodo(bob, { title: "Bob's errand" });
    expect(await service.listTodos(bob, { status: "all" })).toEqual([bobs]);
    expect(
      await service.listTodos(bob, { status: "all", q: "secret" }),
    ).toEqual([]);
  });

  test("get treats another user's todo as not found", async () => {
    const todo = await service.addTodo(alice, { title: "Feed Lissie" });
    await expectNotFound(service.getTodo(bob, todo.id));
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("update can't change another user's todo", async () => {
    const todo = await service.addTodo(alice, { title: "Feed Lissie" });
    await expectNotFound(
      service.updateTodo(bob, todo.id, { title: "Hacked", done: true }),
    );
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("delete can't remove another user's todo", async () => {
    const todo = await service.addTodo(alice, { title: "Feed Lissie" });
    await expectNotFound(service.deleteTodo(bob, todo.id));
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });

  test("progress counts only the user's own todos", async () => {
    const mine = await service.addTodo(alice, { title: "Feed Lissie" });
    await service.updateTodo(alice, mine.id, { done: true });
    await service.addTodo(alice, { title: "Brush Lissie" });
    const theirs = await service.addTodo(bob, { title: "Bob's errand" });
    await service.updateTodo(bob, theirs.id, { done: true });
    await service.addTodo(bob, { title: "Bob's other errand" });
    await service.addTodo(bob, { title: "Bob's third errand" });

    expect(await service.getProgress(alice)).toEqual({
      total: 2,
      done: 1,
      open: 1,
    });
    expect(await service.getProgress(bob)).toEqual({
      total: 3,
      done: 1,
      open: 2,
    });
  });

  test("an unknown id gives the same error as someone else's", async () => {
    await expectNotFound(service.getTodo(alice, crypto.randomUUID()));
    await expectNotFound(
      service.updateTodo(alice, crypto.randomUUID(), { done: true }),
    );
    await expectNotFound(service.deleteTodo(alice, crypto.randomUUID()));
  });
});

describe("add and get", () => {
  test("returns contract todos with a random UUID and ISO timestamps", async () => {
    const todo = await service.addTodo(
      alice,
      { title: "Book the vet", dueDate: "2026-10-09" },
      at("2026-10-05T08:30:00.000Z"),
    );
    expect(TodoSchema.parse(todo)).toEqual(todo);
    expect(todo).toMatchObject({
      title: "Book the vet",
      dueDate: "2026-10-09",
      done: false,
      createdAt: "2026-10-05T08:30:00.000Z",
      completedAt: null,
    });
    expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await service.getTodo(alice, todo.id)).toEqual(todo);
  });
});

describe("update", () => {
  test("done sets completedAt, reopening clears it, and done again keeps the first time", async () => {
    const todo = await service.addTodo(alice, {
      title: "Clean the litter box",
    });
    const done = await service.updateTodo(
      alice,
      todo.id,
      { done: true },
      at("2026-10-05T10:00:00.000Z"),
    );
    expect(done).toMatchObject({
      done: true,
      completedAt: "2026-10-05T10:00:00.000Z",
    });

    const again = await service.updateTodo(
      alice,
      todo.id,
      { done: true },
      at("2026-10-06T10:00:00.000Z"),
    );
    expect(again.completedAt).toBe("2026-10-05T10:00:00.000Z");

    const reopened = await service.updateTodo(alice, todo.id, { done: false });
    expect(reopened).toMatchObject({ done: false, completedAt: null });
  });

  test("changes the title, keeps a due date string as is, and null clears it", async () => {
    const todo = await service.addTodo(alice, {
      title: "Buy treats",
      dueDate: "2026-12-31",
    });
    const renamed = await service.updateTodo(alice, todo.id, {
      title: "Buy salmon treats",
    });
    expect(renamed).toMatchObject({
      title: "Buy salmon treats",
      dueDate: "2026-12-31",
    });
    const cleared = await service.updateTodo(alice, todo.id, { dueDate: null });
    expect(cleared.dueDate).toBeNull();
  });
});

describe("delete", () => {
  test("removes the todo", async () => {
    const todo = await service.addTodo(alice, { title: "Throw out old toys" });
    await service.deleteTodo(alice, todo.id);
    await expectNotFound(service.getTodo(alice, todo.id));
  });

  test("deleting a user deletes their todos", async () => {
    const todo = await service.addTodo(alice, { title: "Feed Lissie" });
    await helpers.deleteUser(alice);
    await expectNotFound(service.getTodo(alice, todo.id));
    const { db } = await import("./db");
    const { todos } = await import("./todo-schema");
    expect(await db.select().from(todos)).not.toContainEqual(
      expect.objectContaining({ id: todo.id }),
    );
  });
});

describe("list", () => {
  test("defaults to open todos and filters by status", async () => {
    const open = await service.addTodo(alice, { title: "Open one" });
    const closed = await service.addTodo(alice, { title: "Done one" });
    await service.updateTodo(alice, closed.id, { done: true });

    expect((await service.listTodos(alice)).map((t) => t.id)).toEqual([
      open.id,
    ]);
    expect(
      (await service.listTodos(alice, { status: "done" })).map((t) => t.id),
    ).toEqual([closed.id]);
    expect(await service.listTodos(alice, { status: "all" })).toHaveLength(2);
  });

  test("searches titles case-insensitively and treats % and _ literally", async () => {
    await service.addTodo(alice, { title: "Buy CAT food" });
    await service.addTodo(alice, { title: "100% tuna" });
    await service.addTodo(alice, { title: "snake_case notes" });
    await service.addTodo(alice, { title: "1000 tunas" });

    const titles = async (q: string) =>
      (await service.listTodos(alice, { q })).map((t) => t.title);
    expect(await titles("cat")).toEqual(["Buy CAT food"]);
    expect(await titles("%")).toEqual(["100% tuna"]);
    expect(await titles("e_c")).toEqual(["snake_case notes"]);
    expect(await titles("  ")).toHaveLength(4);
  });

  test("orders open before done, then by due date with undated last, then by creation", async () => {
    const add = (title: string, dueDate: string | undefined, now: string) =>
      service.addTodo(alice, { title, dueDate }, at(now));
    await add("undated, older", undefined, "2026-10-01T00:00:00.000Z");
    await add("due later", "2026-10-20", "2026-10-02T00:00:00.000Z");
    await add("undated, newer", undefined, "2026-10-03T00:00:00.000Z");
    await add("due soon", "2026-10-06", "2026-10-04T00:00:00.000Z");
    const finished = await add(
      "finished",
      "2026-10-01",
      "2026-09-30T00:00:00.000Z",
    );
    await service.updateTodo(alice, finished.id, { done: true });

    expect(
      (await service.listTodos(alice, { status: "all" })).map((t) => t.title),
    ).toEqual([
      "due soon",
      "due later",
      "undated, older",
      "undated, newer",
      "finished",
    ]);
  });
});

describe("progress", () => {
  test("an empty list is zero of zero", async () => {
    const progress = await service.getProgress(alice);
    expect(TodoProgressSchema.parse(progress)).toEqual(progress);
    expect(progress).toEqual({ total: 0, done: 0, open: 0 });
  });

  test("counts done and open, and follows reopening", async () => {
    const todos = await Promise.all(
      ["one", "two", "three"].map((title) => service.addTodo(alice, { title })),
    );
    await service.updateTodo(alice, todos[0].id, { done: true });
    await service.updateTodo(alice, todos[1].id, { done: true });
    expect(await service.getProgress(alice)).toEqual({
      total: 3,
      done: 2,
      open: 1,
    });

    await service.updateTodo(alice, todos[1].id, { done: false });
    await service.deleteTodo(alice, todos[2].id);
    expect(await service.getProgress(alice)).toEqual({
      total: 2,
      done: 1,
      open: 1,
    });
  });
});
