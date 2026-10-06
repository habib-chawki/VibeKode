import "server-only";
import type {
  ErrorCode,
  NewTodo,
  Todo,
  TodoListFilterInput,
  TodoProgress,
  TodoUpdate,
} from "@todo-cat/contract";
import { and, asc, count, eq, type SQL, sql } from "drizzle-orm";
import { db } from "./db";
import { todos } from "./todo-schema";

// The todo service: every todo query and rule lives here, and nothing else touches
// the todos table. Every function takes the user id first and filters by it.

export class TodoError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TodoError";
  }
}

/** Tests and the seed pass a fixed time; adapters never do. */
export type Clock = { now?: Date };

type TodoRow = typeof todos.$inferSelect;

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

// Same error for a missing id and for another user's id: never reveal that an id exists.
function notFound(): TodoError {
  return new TodoError("todo-not-found", "Todo not found.");
}

function owned(userId: string, id: string): SQL | undefined {
  return and(eq(todos.userId, userId), eq(todos.id, id));
}

export async function listTodos(
  userId: string,
  filter: TodoListFilterInput = {},
): Promise<Todo[]> {
  const conditions: (SQL | undefined)[] = [eq(todos.userId, userId)];
  const status = filter.status ?? "open";
  if (status !== "all") conditions.push(eq(todos.done, status === "done"));
  const q = filter.q?.trim();
  if (q) {
    // LIKE is case-insensitive for ASCII only; escape its wildcards so they match literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(sql`${todos.title} like ${pattern} escape '\\'`);
  }
  const rows = await db
    .select()
    .from(todos)
    .where(and(...conditions))
    .orderBy(
      asc(todos.done),
      sql`${todos.dueDate} is null`,
      asc(todos.dueDate),
      asc(todos.createdAt),
    );
  return rows.map(toTodo);
}

/** Counts the user's whole list in one aggregate query; no rows are loaded. */
export async function getProgress(userId: string): Promise<TodoProgress> {
  const [row] = await db
    .select({
      total: count(),
      done: count(sql`case when ${todos.done} then 1 end`),
    })
    .from(todos)
    .where(eq(todos.userId, userId));
  const total = row?.total ?? 0;
  const done = row?.done ?? 0;
  return { total, done, open: total - done };
}

export async function getTodo(userId: string, id: string): Promise<Todo> {
  const [row] = await db.select().from(todos).where(owned(userId, id));
  if (!row) throw notFound();
  return toTodo(row);
}

export async function addTodo(
  userId: string,
  input: NewTodo,
  clock: Clock = {},
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      id: crypto.randomUUID(),
      userId,
      title: input.title,
      dueDate: input.dueDate ?? null,
      createdAt: clock.now ?? new Date(),
    })
    .returning();
  return toTodo(row);
}

export async function updateTodo(
  userId: string,
  id: string,
  patch: TodoUpdate,
  clock: Clock = {},
): Promise<Todo> {
  const current = await getTodo(userId, id);
  const changes: Partial<typeof todos.$inferInsert> = {};
  if (patch.title !== undefined) changes.title = patch.title;
  if (patch.dueDate !== undefined) changes.dueDate = patch.dueDate;
  if (patch.done !== undefined && patch.done !== current.done) {
    changes.done = patch.done;
    // completedAt is set when a todo is marked done and cleared when it's reopened.
    changes.completedAt = patch.done ? (clock.now ?? new Date()) : null;
  }
  if (Object.keys(changes).length === 0) return current;
  const [row] = await db
    .update(todos)
    .set(changes)
    .where(owned(userId, id))
    .returning();
  if (!row) throw notFound();
  return toTodo(row);
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(todos)
    .where(owned(userId, id))
    .returning({ id: todos.id });
  if (deleted.length === 0) throw notFound();
}
