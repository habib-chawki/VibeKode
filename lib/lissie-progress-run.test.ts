// @vitest-environment node
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

// showProgress through the real runtime, with a fake model that calls it and then
// answers: the card reaches the browser as an A2UI activity, the model sees only the
// numbers, and no request can talk the runtime into adding a UI-generating tool.

let handle: typeof import("./copilot-runtime").handleCopilotRequest;
let lissie: typeof import("./lissie");
let service: typeof import("./todo-service");
let helpers: TestHelpers;
let tearDown: () => void;
let alice: { id: string; token: string };

const finish = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
} as const;

/** What the model was offered and what it got back from the tool, per call. */
const seen: { tools: string[]; toolResult?: unknown }[] = [];

const progressModel = new MockLanguageModelV3({
  doStream: async ({ prompt, tools }) => {
    const last = prompt.at(-1);
    const afterTool = last?.role === "tool";
    seen.push({
      tools: (tools ?? []).map((t) => t.name).sort(),
      toolResult: afterTool ? last.content[0] : undefined,
    });
    const chunks = afterTool
      ? [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Adequate. Barely." },
          { type: "text-end", id: "t" },
          finish,
        ]
      : [
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: `call-${crypto.randomUUID()}`,
            toolName: "showProgress",
            input: "{}",
          },
          {
            ...finish,
            finishReason: { unified: "tool-calls", raw: "tool_calls" },
          },
        ];
    return { stream: simulateReadableStream({ chunks: chunks as never[] }) };
  },
});

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  lissie = await import("./lissie");
  service = await import("./todo-service");
  lissie.setLissieModelForTests(progressModel);
  ({ handleCopilotRequest: handle } = await import("./copilot-runtime"));
  const user = await helpers.saveUser(helpers.createUser({ name: "alice" }));
  alice = {
    id: user.id,
    token: (await helpers.login({ userId: user.id })).token,
  };
  const milk = await service.addTodo(alice.id, { title: "Buy milk" });
  await service.updateTodo(alice.id, milk.id, { done: true });
  await service.addTodo(alice.id, { title: "Feed the cat" });
});

afterAll(() => tearDown?.());

type Event = {
  type: string;
  activityType?: string;
  messageId?: string;
  toolCallId?: string;
  toolCallName?: string;
  content?: unknown;
};

/** A run as the browser sends it, here also asking for every A2UI generation flag. */
async function runEvents(): Promise<Event[]> {
  const response = await handle(
    new Request("http://localhost:3000/api/copilotkit/agent/lissie/run", {
      method: "POST",
      headers: {
        authorization: `Bearer ${alice.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        threadId: lissie.lissieThreadId(alice.id),
        runId: crypto.randomUUID(),
        messages: [
          { id: crypto.randomUUID(), role: "user", content: "How am I doing?" },
        ],
        tools: [],
        context: [],
        state: {},
        forwardedProps: { a2uiCatalogAvailable: true, injectA2UITool: true },
      }),
    }),
  );
  expect(response.status).toBe(200);
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as Event);
}

test("the card reaches the browser as an A2UI surface, with no extra tool", async () => {
  const events = await runEvents();

  const call = events.find((e) => e.type === "TOOL_CALL_START");
  expect(call?.toolCallName).toBe("showProgress");
  const surfaces = events.filter(
    (e) => e.type === "ACTIVITY_SNAPSHOT" && e.activityType === "a2ui-surface",
  );
  expect(surfaces).toHaveLength(1);
  expect(surfaces[0].messageId).toBe(`a2ui-surface-${call?.toolCallId}`);
  const ops = (surfaces[0].content as { a2ui_operations: unknown[] })
    .a2ui_operations;
  expect(ops).toContainEqual({
    version: "v0.9",
    updateDataModel: {
      surfaceId: "todo-progress",
      path: "/",
      value: { total: 2, done: 1, open: 1 },
    },
  });

  // Despite a2uiCatalogAvailable and injectA2UITool, the model only ever sees Lissie's
  // own tools: no render_a2ui from the middleware, no generate_a2ui from the bridge.
  expect(seen.length).toBeGreaterThanOrEqual(2);
  for (const { tools } of seen) {
    expect(tools).toEqual([
      "addTodo",
      "listTodos",
      "setTodoDone",
      "showProgress",
    ]);
  }
  // And the tool result it reads is the numbers, not the component tree.
  const result = JSON.stringify(seen.find((s) => s.toolResult)?.toolResult);
  expect(result).toContain('"total":2');
  expect(result).not.toContain("a2ui_operations");
});

test("the card survives the history replay after a restart", async () => {
  new InMemoryAgentRunner().clearThreads();
  const history = await lissie.loadLissieHistory(alice.id);
  const index = history.findIndex((m) => m.role === "tool");
  const result = history[index] as { toolCallId: string };
  // Right after its tool result, with the id the middleware gave it live.
  const card = history[index + 1];
  expect(card).toMatchObject({
    id: `a2ui-surface-${result.toolCallId}`,
    role: "activity",
    activityType: "a2ui-surface",
  });
  expect(JSON.stringify(card)).toContain(
    '"value":{"total":2,"done":1,"open":1}',
  );
});
