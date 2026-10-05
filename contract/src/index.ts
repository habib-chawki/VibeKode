import { z } from "zod";

// Shared by the server (todo service, adapters) and every client (CLI, MCP).
// Validation happens here, at the adapter boundary; the service trusts these types.

/** A date without time, `yyyy-mm-dd`, never a JavaScript Date (that would shift by time zone). */
export const DueDateSchema = z.iso.date();

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: DueDateSchema.nullable(),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type Todo = z.infer<typeof TodoSchema>;

const TitleSchema = z.string().trim().min(1).max(200);

export const NewTodoSchema = z.object({
  title: TitleSchema,
  dueDate: DueDateSchema.optional(),
});
export type NewTodo = z.infer<typeof NewTodoSchema>;

export const TodoUpdateSchema = z
  .object({
    title: TitleSchema.optional(),
    // null clears the due date; undefined leaves it unchanged
    dueDate: DueDateSchema.nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: "Change at least one of title, dueDate, done.",
  });
export type TodoUpdate = z.infer<typeof TodoUpdateSchema>;

export const TodoStatusSchema = z.enum(["open", "done", "all"]);

export const TodoListFilterSchema = z.object({
  status: TodoStatusSchema.default("open"),
  /** Case-insensitive substring of the title. */
  q: z.string().trim().optional(),
});
export type TodoListFilter = z.infer<typeof TodoListFilterSchema>;
/** What callers may pass before defaults apply, e.g. `{}` for open todos. */
export type TodoListFilterInput = z.input<typeof TodoListFilterSchema>;

export const ErrorCodeSchema = z.enum([
  "todo-not-found",
  "validation-failed",
  "unauthorized",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
