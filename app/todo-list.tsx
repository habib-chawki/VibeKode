"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import {
  ErrorBodySchema,
  type Todo,
  TodoListSchema,
  TodoSchema,
} from "@todo-cat/contract";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { dueLabel } from "./due-label";

// The user's list next to the chat: add, check off, reopen, delete. A client of the REST
// adapter (/api/todos), like the CLI; it reloads when one of Lissie's tools changes the list.

const KNOCK_OFF_MS = 300;

// Lissie's tools that only read the list: their results never need a refetch.
const READ_ONLY_TOOLS = new Set(["listTodos", "showProgress"]);

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye-line";

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

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Read out by screen readers: what the last action did.
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const { agent } = useAgent({ agentId: "lissie", updates: [] });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/todos?status=all", {
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) {
      setTodos(TodoListSchema.parse(await response.json()));
    } else {
      setError("Couldn't load your list. Reload the page to try again.");
    }
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

  /** Runs a change, shows its error if any, then reloads the list either way. */
  async function act(work: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    let ok = true;
    try {
      await work();
    } catch (e) {
      ok = false;
      setError(e instanceof Error ? e.message : String(e));
    }
    await refresh();
    return ok;
  }

  /** Focuses a control in a row once the list has re-rendered, if the row still exists. */
  function focusInRow(todoId: string, selector: string) {
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-todo-id="${todoId}"] ${selector}`)
        ?.focus();
    });
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const dueDate = String(data.get("dueDate") ?? "");
    if (!title) return;
    setAdding(true);
    let added: Todo | undefined;
    await act(async () => {
      const response = await request("POST", "/api/todos", {
        title,
        ...(dueDate ? { dueDate } : {}),
      });
      added = TodoSchema.parse(await response.json());
      form.reset();
    });
    setAdding(false);
    titleRef.current?.focus();
    if (!added) return;
    const { id } = added;
    setAnnouncement(`Added "${added.title}".`);
    // The list is sorted by due date, not by when a todo was added: show where it landed.
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector(`[data-todo-id="${id}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  }

  // Optimistic: the box flips at once; the refresh after the request settles the truth.
  async function toggle(todo: Todo) {
    setTodos(
      (current) =>
        current?.map((t) =>
          t.id === todo.id ? { ...t, done: !todo.done } : t,
        ) ?? current,
    );
    const ok = await act(() =>
      request("PATCH", `/api/todos/${todo.id}`, { done: !todo.done }),
    );
    if (ok) {
      setAnnouncement(
        `${todo.done ? "Reopened" : "Checked off"} "${todo.title}".`,
      );
    }
    // The row moved between Open and Done; the keyboard moves with it.
    focusInRow(todo.id, 'input[type="checkbox"]');
  }

  function askToDelete(todo: Todo) {
    setConfirming(todo.id);
    focusInRow(todo.id, "[data-keep]");
  }

  function keep(todo: Todo) {
    setConfirming(null);
    focusInRow(todo.id, "[data-delete]");
  }

  async function remove(todo: Todo, next: Todo | undefined) {
    setLeaving(todo.id);
    await new Promise((resolve) => setTimeout(resolve, KNOCK_OFF_MS));
    // Off the table now, not when the server answers: the rows below close up at once.
    setTodos((current) => current?.filter((t) => t.id !== todo.id) ?? current);
    setLeaving(null);
    setConfirming(null);
    const ok = await act(() => request("DELETE", `/api/todos/${todo.id}`));
    if (ok) setAnnouncement(`Deleted "${todo.title}".`);
    if (next) focusInRow(next.id, 'input[type="checkbox"]');
    else titleRef.current?.focus();
  }

  const today = localToday();
  const open = todos?.filter((t) => !t.done) ?? [];
  const done = todos?.filter((t) => t.done) ?? [];

  const row = (todo: Todo, index: number, section: Todo[]) => {
    const due =
      todo.dueDate && !todo.done ? dueLabel(todo.dueDate, today) : null;
    const isConfirming = confirming === todo.id;
    // Esc in the confirmation means Keep.
    const escapeKeeps = (event: KeyboardEvent) => {
      if (event.key === "Escape") keep(todo);
    };
    return (
      <li
        key={todo.id}
        data-testid="todo-item"
        data-todo-id={todo.id}
        className={`py-1 ${leaving === todo.id ? "knocked-off" : ""}`}
      >
        <div className="flex items-start gap-1.5">
          {/* A 28px hit area around the 16px box. */}
          <label className="-my-1 grid size-7 shrink-0 cursor-pointer place-items-center">
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggle(todo)}
              aria-label={
                todo.done
                  ? `Reopen "${todo.title}"`
                  : `Check off "${todo.title}"`
              }
              className={`size-4 cursor-pointer accent-eye ${todo.done ? "opacity-60" : ""} ${focusRing}`}
            />
          </label>
          <div className="min-w-0 flex-1 pt-px">
            <p
              className={`text-sm break-words ${todo.done ? "text-fur line-through" : "text-ink"}`}
            >
              {todo.title}
            </p>
            {due && todo.dueDate ? (
              <p
                className={`text-xs ${
                  due.tone === "overdue"
                    ? "font-medium text-nose"
                    : due.tone === "today"
                      ? "font-medium text-ink"
                      : "text-fur"
                }`}
              >
                <time dateTime={todo.dueDate}>{due.text}</time>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            data-delete
            onClick={() => (isConfirming ? keep(todo) : askToDelete(todo))}
            aria-label={`Delete "${todo.title}"`}
            aria-expanded={isConfirming}
            className={`-my-1 grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-nose/10 hover:text-nose ${isConfirming ? "bg-nose/10 text-nose" : "text-fur"} ${focusRing}`}
          >
            <DeleteIcon />
          </button>
        </div>
        {isConfirming ? (
          // The question on its own line and the answers under it: in a 16rem column the
          // three never fit on one line, and a wrapped "Keep" reads like a separate thing.
          <div className="mt-1 ml-[2.125rem]">
            <p className="text-sm text-ink">Delete it for good?</p>
            <div className="-ml-2.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => remove(todo, section[index + 1])}
                onKeyDown={escapeKeeps}
                className={`h-8 rounded-md px-2.5 text-sm font-medium text-nose transition-colors hover:bg-nose/10 ${focusRing}`}
              >
                Delete
              </button>
              <button
                type="button"
                data-keep
                onClick={() => keep(todo)}
                onKeyDown={escapeKeeps}
                className={`h-8 rounded-md px-2.5 text-sm text-fur transition-colors hover:bg-fur/10 hover:text-ink ${focusRing}`}
              >
                Keep
              </button>
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  const sectionHeading = (label: string, count: number) => (
    <h3 className="px-1 text-sm font-medium text-ink">
      {label}{" "}
      <span className="font-normal text-fur tabular-nums">({count})</span>
    </h3>
  );

  return (
    <aside
      aria-labelledby="todo-list-heading"
      data-testid="todo-list"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-fur/25 bg-surface"
    >
      {/* The date row shows once a title is typed, so the list keeps the room. Not on focus:
          hiding it on blur would shift the list under the pointer mid-click. */}
      <form
        onSubmit={add}
        className="group flex flex-col gap-2 border-b border-fur/20 p-3"
      >
        <h2
          id="todo-list-heading"
          className="font-display text-base font-bold text-ink"
        >
          Your list
        </h2>
        <div className="flex items-center gap-2">
          <input
            ref={titleRef}
            id="new-todo"
            name="title"
            required
            maxLength={200}
            placeholder="Add a todo"
            aria-label="Add a todo"
            autoComplete="off"
            className={`h-9 min-w-0 flex-1 rounded-lg border border-fur/75 bg-paper px-2.5 text-base text-ink placeholder:text-fur focus-visible:border-ink sm:text-sm ${focusRing} focus-visible:outline-offset-1`}
          />
          <Button type="submit" size="sm" disabled={adding}>
            Add
          </Button>
        </div>
        <div className="hidden items-center gap-2 group-has-[#new-todo:not(:placeholder-shown)]:flex">
          <label htmlFor="new-todo-due" className="text-xs text-fur">
            Due
          </label>
          <input
            id="new-todo-due"
            type="date"
            name="dueDate"
            aria-label="Due date (optional)"
            className={`h-8 min-w-0 flex-1 rounded-lg border border-fur/75 bg-paper px-2 text-base text-ink sm:text-xs ${focusRing} focus-visible:outline-offset-1`}
          />
        </div>
        <FormError message={error} />
      </form>
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-color:color-mix(in_oklab,var(--fur)_40%,transparent)_transparent] [scrollbar-width:thin]"
      >
        {todos === null ? (
          <p className="px-1 py-2 text-sm text-fur">Loading your list…</p>
        ) : (
          <>
            {sectionHeading("Open", open.length)}
            {open.length === 0 ? (
              <p className="px-1 py-2 text-sm text-fur">
                Nothing open. Suspicious.
              </p>
            ) : (
              <ul className="mt-1">{open.map(row)}</ul>
            )}
            {done.length > 0 ? (
              <>
                <div className="mt-4">
                  {sectionHeading("Done", done.length)}
                </div>
                <ul className="mt-1">{done.map(row)}</ul>
              </>
            ) : null}
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </aside>
  );
}
