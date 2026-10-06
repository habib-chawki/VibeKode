import "server-only";
import type { AssistantMessage, Message, ToolCall } from "@ag-ui/core";
import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { db } from "./db";
import { lissieTools } from "./lissie-tools";

// Lissie: the user's cat, who keeps their to-do list. A Mastra agent with memory in our
// SQLite file (Mastra's own `mastra_*` tables, created on first use), one thread per user.

export const LISSIE_INSTRUCTIONS = `You are Lissie, the user's cat. You keep their to-do list, because clearly nobody else in this household can be trusted with it.

Character:
- Dry, superior and unimpressed, the way only a cat can be. Short sentences. No exclamation marks unless something is truly beneath you.
- Secretly, you care. When the human gets something done, you allow a sliver of approval. When they're overwhelmed, you're quietly helpful, then pretend it was nothing.
- You speak about yourself as a cat would: naps, sunbeams, the food bowl, knocking things off tables. Never as an AI, an assistant or a language model.

Scope:
- You only deal with the to-do list: what's on it, what's due, what to do next, how to get through it. That's your whole job, and you take it very seriously.
- Politely and in character, decline everything else (trivia, coding help, recipes, the weather, other people's business). One line, a cat's excuse, then steer back to the list.

The list, through your tools:
- listTodos shows the list (open by default; done or all on request). Use it before answering anything about the list, and never invent todos.
- addTodo adds one. Keep the human's words for the title; turn "Friday" or "tomorrow" into a yyyy-mm-dd due date using today's date below, and say which date you chose.
- setTodoDone marks a todo done (or open again). Find its id with listTodos first; if several todos fit, ask which one.
- Add every item when the human lists several things; one tool call per todo.
- showProgress puts a card in the chat with how many todos there are, done and open. Use it when the human asks how they're doing, how far along they are, or for their progress. The card already shows the numbers: don't repeat them, give one line of judgement instead.
- Comment in character on every todo you add and every todo marked done. Feeding the cat being done is a matter of personal importance: have opinions about it (was it the good food?).
- If a tool reports todo-not-found, say you can't find it; don't pretend it worked.

Keep replies brief: two or three sentences unless the human asks for more.`;

/** One conversation per user: the thread id is derived from the user id, never chosen by a client. */
export function lissieThreadId(userId: string): string {
  return `lissie-${userId}`;
}

type LissieModel = ConstructorParameters<typeof Agent>[0]["model"];

/** OpenRouter via Mastra's model router; the key is read here, on the server only. */
export function openRouterModel(): LissieModel {
  return {
    id: `openrouter/${process.env.OPENROUTER_MODEL || "z-ai/glm-5.3-flash"}`,
    apiKey: process.env.OPENROUTER_API_KEY,
  };
}

/** The server's local date: relative due dates ("Friday") need to know what today is. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function createLissie(model: LissieModel): Agent {
  return new Agent({
    id: "lissie",
    name: "Lissie",
    // Evaluated on every run, so the date is never stale.
    instructions: () => `${LISSIE_INSTRUCTIONS}\n\nToday is ${today()}.`,
    model,
    tools: lissieTools,
    memory: new Memory({
      // Reuse lib/db.ts's client: one connection, one place that interprets DATABASE_URL.
      storage: new LibSQLStore({ id: "lissie-memory", client: db.$client }),
      options: { lastMessages: 30 },
    }),
  });
}

// Cached on globalThis so dev hot reloads don't pile up agents and stores.
const cache = globalThis as unknown as { lissie?: Agent };

export function getLissie(): Agent {
  cache.lissie ??= createLissie(openRouterModel());
  return cache.lissie;
}

/** Tests only: run Lissie on a fake model instead of OpenRouter. */
export function setLissieModelForTests(model: LissieModel): void {
  cache.lissie = createLissie(model);
}

type ToolInvocation = {
  state?: string;
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  errorText?: string;
};
type StoredPart = {
  type?: string;
  text?: string;
  toolInvocation?: ToolInvocation;
};
type StoredMessage = {
  id: string;
  role: string;
  content?: { parts?: StoredPart[]; content?: string } | string;
};

/**
 * A tool result that drew an A2UI surface (showProgress) as the activity message the
 * runtime's A2UI middleware emitted live, with the same id, so the card replays too.
 */
function a2uiSurface(call: ToolInvocation): Message | null {
  const operations = (call.result as { a2ui_operations?: unknown } | null)
    ?.a2ui_operations;
  if (!Array.isArray(operations)) return null;
  return {
    id: `a2ui-surface-${call.toolCallId}`,
    role: "activity",
    activityType: "a2ui-surface",
    content: { a2ui_operations: operations },
  };
}

/**
 * One stored Mastra message as AG-UI messages, split the way @ag-ui/mastra streams it
 * live: text and tool calls in `<id>`, each result as `<toolCallId>-result`, text after a
 * tool call as `<id>-agui-text`, `-agui-text-2`, …. Matching ids let the bridge recognise
 * re-sent history, so it isn't stored twice.
 */
function toAgui(message: StoredMessage): Message[] {
  const { id, role, content } = message;
  if (role !== "user" && role !== "assistant") return [];
  if (typeof content === "string")
    return content ? [{ id, role, content }] : [];
  const parts = content?.parts ?? [];
  if (role === "user") {
    const text = parts
      .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
      .join("");
    const value = text || content?.content || "";
    return value ? [{ id, role, content: value }] : [];
  }

  const out: Message[] = [];
  let current: AssistantMessage = { id, role: "assistant" };
  let segment = 0;
  let results: Message[] = [];
  const flush = () => {
    if (current.content || current.toolCalls?.length) out.push(current);
    out.push(...results);
    results = [];
  };
  for (const part of parts) {
    if (part.type === "text" && part.text) {
      if (current.toolCalls?.length) {
        flush();
        segment += 1;
        current = {
          id: segment === 1 ? `${id}-agui-text` : `${id}-agui-text-${segment}`,
          role: "assistant",
        };
      }
      current.content = (current.content ?? "") + part.text;
    } else if (part.type === "tool-invocation" && part.toolInvocation) {
      const call = part.toolInvocation;
      const toolCall: ToolCall = {
        id: call.toolCallId,
        type: "function",
        function: {
          name: call.toolName,
          arguments: JSON.stringify(call.args ?? {}),
        },
      };
      current.toolCalls = [...(current.toolCalls ?? []), toolCall];
      if (call.state === "result" || call.isError) {
        results.push({
          id: `${call.toolCallId}-result`,
          role: "tool",
          toolCallId: call.toolCallId,
          content: JSON.stringify(call.result ?? null),
          ...(call.isError ? { error: call.errorText ?? "Tool failed." } : {}),
        });
        const surface = a2uiSurface(call);
        if (surface) results.push(surface);
      }
    }
  }
  flush();
  return out;
}

/** The user's conversation from Mastra memory, as AG-UI messages, tool calls included. */
export async function loadLissieHistory(userId: string): Promise<Message[]> {
  const memory = await getLissie().getMemory();
  if (!memory) return [];
  try {
    const { messages } = await memory.recall({
      threadId: lissieThreadId(userId),
      resourceId: userId,
      perPage: false,
    });
    return (messages as unknown as StoredMessage[]).flatMap(toAgui);
  } catch {
    // recall() throws for a thread that doesn't exist yet: a new user, an empty chat.
    return [];
  }
}
