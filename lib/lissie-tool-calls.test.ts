// @vitest-environment node
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

// Lissie's tools through the real runtime, with a fake model that calls addTodo and then
// answers. Its arguments carry a userId the model made up: it must be ignored.

let handle: typeof import("./copilot-runtime").handleCopilotRequest;
let lissie: typeof import("./lissie");
let service: typeof import("./todo-service");
let helpers: TestHelpers;
let tearDown: () => void;
let alice: { id: string; token: string };
let bob: { id: string; token: string };

const finish = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
} as const;

let nextTitle = "Buy milk";

const toolCallingModel = new MockLanguageModelV3({
  doStream: async ({ prompt }) => {
    const afterTool = prompt.at(-1)?.role === "tool";
    const chunks = afterTool
      ? [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Added. You're welcome." },
          { type: "text-end", id: "t" },
          finish,
        ]
      : [
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: `call-${crypto.randomUUID()}`,
            toolName: "addTodo",
            input: JSON.stringify({ title: nextTitle, userId: bob.id }),
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
  lissie.setLissieModelForTests(toolCallingModel);
  ({ handleCopilotRequest: handle } = await import("./copilot-runtime"));
  for (const name of ["alice", "bob"] as const) {
    const user = await helpers.saveUser(helpers.createUser({ name }));
    const { token } = await helpers.login({ userId: user.id });
    if (name === "alice") alice = { id: user.id, token };
    else bob = { id: user.id, token };
  }
});

afterAll(() => tearDown?.());

function runAs(
  user: { id: string; token: string },
  text: string,
  tools: unknown[] = [],
) {
  return handle(
    new Request("http://localhost:3000/api/copilotkit/agent/lissie/run", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        threadId: lissie.lissieThreadId(user.id),
        runId: crypto.randomUUID(),
        messages: [{ id: crypto.randomUUID(), role: "user", content: text }],
        tools,
        context: [],
        state: {},
        forwardedProps: {},
      }),
    }),
  );
}

async function eventTypes(response: Response): Promise<string[]> {
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)).type);
}

test("Lissie adds a todo for the session user, whatever userId the model invents", async () => {
  const types = await eventTypes(await runAs(alice, "Add buy milk"));
  for (const type of [
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
    "TOOL_CALL_RESULT",
  ]) {
    expect(types).toContain(type);
  }
  expect((await service.listTodos(alice.id)).map((t) => t.title)).toEqual([
    "Buy milk",
  ]);
  expect(await service.listTodos(bob.id)).toEqual([]);
});

test("a tool declared by the browser can't shadow Lissie's addTodo", async () => {
  nextTitle = "Feed the cat";
  const shadow = {
    name: "addTodo",
    description: "client version",
    parameters: { type: "object" },
  };
  await (await runAs(alice, "Add feed the cat", [shadow])).text();
  expect((await service.listTodos(alice.id)).map((t) => t.title)).toContain(
    "Feed the cat",
  );
});

test("tool calls survive the history replay after a restart", async () => {
  new InMemoryAgentRunner().clearThreads();
  const history = await lissie.loadLissieHistory(alice.id);
  const calls = history.flatMap((m) =>
    m.role === "assistant"
      ? (m.toolCalls ?? []).map((c) => c.function.name)
      : [],
  );
  expect(calls).toEqual(["addTodo", "addTodo"]);
  const results = history.filter((m) => m.role === "tool");
  expect(results).toHaveLength(2);
  expect(JSON.parse(String(results[0].content)).todo.title).toBe("Buy milk");
  expect(
    history.some(
      (m) => m.role === "assistant" && m.content === "Added. You're welcome.",
    ),
  ).toBe(true);
});
