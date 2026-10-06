import "server-only";
import type { Message } from "@ag-ui/core";
import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { db } from "./db";

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
- You can't see or change the list yet; nobody has connected your eyes to it. If asked what's on it or to change it, say so in character and suggest they use the list themselves for now. Never invent todos.

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

function createLissie(model: LissieModel): Agent {
  return new Agent({
    id: "lissie",
    name: "Lissie",
    instructions: LISSIE_INSTRUCTIONS,
    model,
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

type StoredPart = { type?: string; text?: string };
type StoredMessage = {
  id: string;
  role: string;
  content?: { parts?: StoredPart[]; content?: string } | string;
};

function textOf(message: StoredMessage): string {
  const { content } = message;
  if (typeof content === "string") return content;
  const parts = content?.parts ?? [];
  const text = parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  return text || content?.content || "";
}

/**
 * The user's conversation from Mastra memory, as AG-UI messages. Ids stay Mastra's, so
 * @ag-ui/mastra recognises re-sent history and doesn't store it twice.
 */
export async function loadLissieHistory(userId: string): Promise<Message[]> {
  const memory = await getLissie().getMemory();
  if (!memory) return [];
  try {
    const { messages } = await memory.recall({
      threadId: lissieThreadId(userId),
      resourceId: userId,
      perPage: false,
    });
    return (messages as unknown as StoredMessage[])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: textOf(m),
      }))
      .filter((m) => m.content.length > 0);
  } catch {
    // recall() throws for a thread that doesn't exist yet: a new user, an empty chat.
    return [];
  }
}
