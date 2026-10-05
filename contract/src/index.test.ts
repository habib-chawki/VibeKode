import { describe, expect, test } from "vitest";
import {
  ErrorBodySchema,
  NewTodoSchema,
  TodoListFilterSchema,
  TodoSchema,
  TodoUpdateSchema,
} from "./index";

describe("NewTodoSchema", () => {
  test("trims the title and keeps a real due date", () => {
    expect(
      NewTodoSchema.parse({ title: "  Buy cat food ", dueDate: "2026-10-07" }),
    ).toEqual({ title: "Buy cat food", dueDate: "2026-10-07" });
  });

  test("rejects an empty title and impossible or timed dates", () => {
    expect(NewTodoSchema.safeParse({ title: "   " }).success).toBe(false);
    for (const dueDate of [
      "2026-02-30",
      "2026-13-01",
      "2026-10-07T10:00:00Z",
    ]) {
      expect(NewTodoSchema.safeParse({ title: "x", dueDate }).success).toBe(
        false,
      );
    }
  });
});

describe("TodoUpdateSchema", () => {
  test("needs at least one field", () => {
    expect(TodoUpdateSchema.safeParse({}).success).toBe(false);
    expect(TodoUpdateSchema.safeParse({ done: true }).success).toBe(true);
  });

  test("allows null to clear the due date", () => {
    expect(TodoUpdateSchema.parse({ dueDate: null })).toEqual({
      dueDate: null,
    });
  });
});

describe("TodoListFilterSchema", () => {
  test("defaults to open todos", () => {
    expect(TodoListFilterSchema.parse({})).toEqual({ status: "open" });
  });

  test("rejects unknown statuses", () => {
    expect(TodoListFilterSchema.safeParse({ status: "later" }).success).toBe(
      false,
    );
  });
});

test("TodoSchema and ErrorBodySchema accept the wire shapes", () => {
  expect(
    TodoSchema.safeParse({
      id: "3f2b9c1e-0000-4000-8000-000000000000",
      title: "Brush Lissie",
      dueDate: null,
      done: false,
      createdAt: "2026-10-05T12:00:00.000Z",
      completedAt: null,
    }).success,
  ).toBe(true);
  expect(
    ErrorBodySchema.safeParse({
      error: { code: "todo-not-found", message: "Todo not found." },
    }).success,
  ).toBe(true);
});
