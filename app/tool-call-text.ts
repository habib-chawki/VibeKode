// The text of one tool-call line in Lissie's chat (app/tool-call-line.tsx). No React or
// CopilotKit here, so it's testable on its own.

type TodoLike = { title?: string; dueDate?: string | null; done?: boolean };
type Result = { todo?: TodoLike; todos?: TodoLike[]; error?: { code: string } };

function parse(result: string | undefined): Result {
  try {
    return result ? (JSON.parse(result) as Result) : {};
  } catch {
    return {};
  }
}

/** The line for one tool call; `done` once its result is in. */
export function describeToolCall(
  name: string,
  args: Record<string, unknown>,
  done: boolean,
  result: string | undefined,
): string {
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
      if (!done) return "Counting your list…";
      if (error) return "✗ Couldn't count your list";
      return "Counted your list";
    default:
      return done ? `✓ ${name}` : `${name}…`;
  }
}
