import "server-only";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { progressOperations, type TodoProgress } from "./lissie-progress-card";
import { sessionUser } from "./lissie-tools";
import { listTodos } from "./todo-service";

// showProgress: Lissie's progress card. The numbers come from the todo service and the
// card from a fixed tree (lib/lissie-progress-card.ts); no model writes either, and
// there's no second model call.

export async function todoProgress(userId: string): Promise<TodoProgress> {
  const todos = await listTodos(userId, { status: "all" });
  const done = todos.filter((todo) => todo.done).length;
  return { total: todos.length, done, open: todos.length - done };
}

export const showProgressTool = createTool({
  id: "showProgress",
  description:
    "Show the user a progress card for their whole list: how many todos there are, how many are done and how many are open. No input. The card shows the numbers; the result gives you the same numbers to comment on.",
  inputSchema: z.object({}),
  // The runtime's A2UI middleware renders any tool result with an `a2ui_operations` array.
  execute: async (_input, { requestContext }) => {
    const progress = await todoProgress(sessionUser(requestContext));
    return { ...progress, a2ui_operations: progressOperations(progress) };
  },
  // The model needs the numbers, not the card's component tree.
  toModelOutput: (output) => {
    const { total, done, open } = output as TodoProgress;
    return { type: "json", value: { total, done, open } };
  },
});
