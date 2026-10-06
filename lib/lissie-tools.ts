import "server-only";
import {
  MASTRA_RESOURCE_ID_KEY,
  type RequestContext,
} from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { NewTodoSchema, TodoListFilterSchema } from "@todo-cat/contract";
import { z } from "zod";
import { progressOperations } from "./lissie-progress-card";
import {
  addTodo,
  getProgress,
  listTodos,
  TodoError,
  updateTodo,
} from "./todo-service";

// Lissie's tools: one more thin adapter on the todo service, like REST and the CLI.
// The user is never an argument: lib/copilot-runtime.ts puts the session user into
// Mastra's reserved resource key, which no client or model can set.

export function sessionUser(requestContext: RequestContext): string {
  const userId = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Lissie's tools need a signed-in user.");
  }
  return userId;
}

/** Service errors become a result the model can talk about, instead of a failed run. */
async function asResult<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TodoError) {
      return { error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

export const listTodosTool = createTool({
  id: "listTodos",
  description:
    "List the user's todos. status: open (default), done or all; q: optional text to search in titles. Returns todos with id, title, dueDate (yyyy-mm-dd or null) and done.",
  inputSchema: TodoListFilterSchema,
  execute: async (filter, { requestContext }) =>
    asResult(async () => ({
      todos: await listTodos(sessionUser(requestContext), filter),
    })),
});

export const addTodoTool = createTool({
  id: "addTodo",
  description:
    "Add a todo to the user's list. title: what to do, in the user's words; dueDate: optional, yyyy-mm-dd. Returns the new todo.",
  inputSchema: NewTodoSchema,
  execute: async (input, { requestContext }) =>
    asResult(async () => ({
      todo: await addTodo(sessionUser(requestContext), input),
    })),
});

export const setTodoDoneTool = createTool({
  id: "setTodoDone",
  description:
    "Mark one of the user's todos as done (done: true, the default) or open again (done: false). id: the todo's id from listTodos; look it up first, never guess. Returns the updated todo.",
  inputSchema: z.object({
    id: z.string().min(1),
    done: z.boolean().default(true),
  }),
  execute: async ({ id, done }, { requestContext }) =>
    asResult(async () => ({
      todo: await updateTodo(sessionUser(requestContext), id, { done }),
    })),
});

export const showProgressTool = createTool({
  id: "showProgress",
  description:
    "Show the user a progress card for their whole list: how many todos there are, how many are done and how many are open. No input. The card shows the numbers; the result gives you the same numbers to comment on.",
  inputSchema: z.object({}),
  // The runtime's A2UI middleware draws any tool result with an `a2ui_operations` array
  // as a card (lib/lissie-progress-card.ts); no model writes it, no second model call.
  execute: async (_input, { requestContext }) =>
    asResult(async () => {
      const progress = await getProgress(sessionUser(requestContext));
      return { ...progress, a2ui_operations: progressOperations(progress) };
    }),
  // The model needs the numbers (or the error), not the card's component tree.
  toModelOutput: (output) => {
    const { a2ui_operations: _card, ...rest } = output as Record<
      string,
      unknown
    >;
    return { type: "json", value: rest };
  },
});

export const lissieTools = {
  listTodos: listTodosTool,
  addTodo: addTodoTool,
  setTodoDone: setTodoDoneTool,
  showProgress: showProgressTool,
};
