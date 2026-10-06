"use client";

import {
  type ReactToolCallRenderer,
  ToolCallStatus,
} from "@copilotkit/react-core/v2";

// One readable line per tool call in Lissie's chat, live and after a history replay.

type TodoLike = { title?: string; dueDate?: string | null; done?: boolean };
type Result = { todo?: TodoLike; todos?: TodoLike[]; error?: { code: string } };

function parse(result: string | undefined): Result {
  try {
    return result ? (JSON.parse(result) as Result) : {};
  } catch {
    return {};
  }
}

function describe(
  name: string,
  args: Record<string, unknown>,
  status: ToolCallStatus,
  result: string | undefined,
): string {
  const done = status === ToolCallStatus.Complete;
  const { todo, todos, error } = parse(result);
  const title =
    todo?.title ?? (typeof args.title === "string" ? args.title : "");
  switch (name) {
    case "addTodo":
      if (!done) return `Adding "${title}"…`;
      if (error) return `✗ Couldn't add "${title}"`;
      return `✓ Added "${title}"${todo?.dueDate ? `, due ${todo.dueDate}` : ""}`;
    case "setTodoDone":
      if (!done) return "Updating a todo…";
      if (error) return "✗ Couldn't find that todo";
      return todo?.done ? `✓ Done: "${title}"` : `↺ Reopened "${title}"`;
    case "listTodos":
      if (!done) return "Looking at your list…";
      return `Looked at your list (${todos?.length ?? 0} ${args.status === "done" ? "done" : args.status === "all" ? "todos" : "open"})`;
    case "showProgress":
      return done ? "Counted your list" : "Counting your list…";
    default:
      return done ? `✓ ${name}` : `${name}…`;
  }
}

// Module level: CopilotKit wants a stable array.
export const lissieToolRenderers: ReactToolCallRenderer<
  Record<string, unknown>
>[] = [
  {
    name: "*",
    agentId: "lissie",
    render: ({ name, args, status, result }) => (
      <p className="my-1 text-sm text-fur" data-testid="lissie-tool-call">
        {describe(
          name,
          (args ?? {}) as Record<string, unknown>,
          status,
          result,
        )}
      </p>
    ),
  },
];
