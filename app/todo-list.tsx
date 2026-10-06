"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { ErrorBodySchema, type Todo, TodoListSchema } from "@todo-cat/contract";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// The user's list next to the chat: add, check off, reopen, delete. A client of the REST
// adapter (/api/todos), like the CLI; it reloads when one of Lissie's tools changes the list.

const KNOCK_OFF_MS = 300;

// Lissie's tools that only read the list: their results never need a refetch.
const READ_ONLY_TOOLS = new Set(["listTodos", "showProgress"]);

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new Error(
      parsed.success
        ? parsed.data.error.message
        : "Something went wrong. Try again.",
    );
  }
  return response;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
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
        if (!call || !READ_ONLY_TOOLS.has(call.function.name)) refresh();
      },
      onRunFinalized: () => {
        refresh();
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, refresh]);

  async function act(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await refresh();
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const dueDate = String(data.get("dueDate") ?? "");
    if (!title) return;
    await act(async () => {
      await request("POST", "/api/todos", {
        title,
        ...(dueDate ? { dueDate } : {}),
      });
      form.reset();
    });
  }

  // Optimistic: the box flips at once; the refresh after the request settles the truth.
  const toggle = (todo: Todo) => {
    setTodos(
      (current) =>
        current?.map((t) =>
          t.id === todo.id ? { ...t, done: !todo.done } : t,
        ) ?? current,
    );
    return act(() =>
      request("PATCH", `/api/todos/${todo.id}`, { done: !todo.done }),
    );
  };

  async function remove(todo: Todo) {
    setLeaving(todo.id);
    await new Promise((resolve) => setTimeout(resolve, KNOCK_OFF_MS));
    await act(() => request("DELETE", `/api/todos/${todo.id}`));
    setLeaving(null);
    setConfirming(null);
  }

  const today = localToday();
  const open = todos?.filter((t) => !t.done) ?? [];
  const done = todos?.filter((t) => t.done) ?? [];

  const row = (todo: Todo) => {
    const overdue = !todo.done && todo.dueDate !== null && todo.dueDate < today;
    return (
      <li
        key={todo.id}
        data-testid="todo-item"
        className={`group flex items-start gap-2.5 py-1.5 ${leaving === todo.id ? "knocked-off" : ""}`}
      >
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => toggle(todo)}
          aria-label={
            todo.done ? `Reopen "${todo.title}"` : `Check off "${todo.title}"`
          }
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-eye"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm break-words ${todo.done ? "text-fur line-through" : "text-ink"}`}
          >
            {todo.title}
          </p>
          {todo.dueDate ? (
            <p
              className={`text-xs ${overdue ? "font-medium text-nose" : "text-fur"}`}
            >
              {overdue ? "Overdue · was due " : "Due "}
              <span className="whitespace-nowrap">{todo.dueDate}</span>
            </p>
          ) : null}
          {confirming === todo.id ? (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-ink">Delete it for good?</span>
              <button
                type="button"
                onClick={() => remove(todo)}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-nose hover:bg-nose/10 focus-visible:outline-2 focus-visible:outline-eye"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded px-1.5 py-0.5 text-xs text-fur hover:bg-fur/10 focus-visible:outline-2 focus-visible:outline-eye"
              >
                Keep
              </button>
            </div>
          ) : null}
        </div>
        {confirming === todo.id ? null : (
          <button
            type="button"
            onClick={() => setConfirming(todo.id)}
            aria-label={`Delete "${todo.title}"`}
            className="shrink-0 rounded px-1 text-sm text-fur opacity-60 group-hover:opacity-100 hover:text-nose focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-eye"
          >
            ×
          </button>
        )}
      </li>
    );
  };

  return (
    <aside
      aria-label="Your list"
      data-testid="todo-list"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fur/25 bg-surface"
    >
      <form
        onSubmit={add}
        className="flex flex-col gap-2 border-b border-fur/20 p-3"
      >
        <label
          htmlFor="new-todo"
          className="font-display text-base font-bold text-ink"
        >
          Your list
        </label>
        <input
          id="new-todo"
          name="title"
          required
          maxLength={200}
          placeholder="Add a todo"
          aria-label="New todo"
          className="rounded-md border border-fur/35 bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-fur/80 focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-eye"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="dueDate"
            aria-label="Due date (optional)"
            className="min-w-0 flex-1 rounded-md border border-fur/35 bg-paper px-2 py-1 text-xs text-ink focus-visible:outline-2 focus-visible:outline-eye"
          />
          <Button type="submit" className="px-3 py-1.5 text-sm">
            Add
          </Button>
        </div>
        <FormError message={error} />
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <h2 className="text-xs font-medium text-fur">Open ({open.length})</h2>
        {todos && open.length === 0 ? (
          <p className="py-2 text-sm text-fur">Nothing open. Suspicious.</p>
        ) : (
          <ul>{open.map(row)}</ul>
        )}
        {done.length > 0 ? (
          <>
            <h2 className="mt-3 text-xs font-medium text-fur">
              Done ({done.length})
            </h2>
            <ul>{done.map(row)}</ul>
          </>
        ) : null}
      </div>
    </aside>
  );
}
