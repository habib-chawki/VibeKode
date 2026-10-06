"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { type Todo, TodoListSchema } from "@todo-cat/contract";
import { useCallback, useEffect, useState } from "react";

// Read-only for now: Lissie is the browser's write path. Reloads from the REST API
// whenever one of her tools changes something, and when a run ends.
export function TodoSidebar() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const { agent } = useAgent({ agentId: "lissie", updates: [] });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/todos?status=all", {
      cache: "no-store",
    });
    if (response.ok) setTodos(TodoListSchema.parse(await response.json()));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = agent.subscribe({
      onToolCallResultEvent: ({ event, messages }) => {
        const call = messages
          .flatMap((m) => (m.role === "assistant" ? (m.toolCalls ?? []) : []))
          .find((c) => c.id === event.toolCallId);
        if (call?.function.name !== "listTodos") refresh();
      },
      onRunFinalized: () => {
        refresh();
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, refresh]);

  const open = todos?.filter((t) => !t.done) ?? [];
  const done = todos?.filter((t) => t.done) ?? [];

  return (
    <aside
      aria-label="Your list"
      data-testid="todo-sidebar"
      className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-fur/30 bg-surface p-4"
    >
      <section>
        <h2 className="text-sm font-semibold text-ink">Open ({open.length})</h2>
        {todos && open.length === 0 ? (
          <p className="mt-2 text-sm text-fur">Nothing open. Suspicious.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {open.map((t) => (
              <li key={t.id} className="text-sm text-ink">
                {t.title}
                {t.dueDate ? (
                  <span className="text-fur"> · due {t.dueDate}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-ink">
            Done ({done.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {done.map((t) => (
              <li key={t.id} className="text-sm text-fur line-through">
                {t.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
