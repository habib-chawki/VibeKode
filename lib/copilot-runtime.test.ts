// @vitest-environment node
import type { LanguageModelV3CallOptions } from "@ai-sdk/provider";
import { InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

// Every route the CopilotKit runtime serves, against Lissie on a fake model (no API key).

let handle: typeof import("./copilot-runtime").handleCopilotRequest;
let lissie: typeof import("./lissie");
let helpers: TestHelpers;
let tearDown: () => void;
let alice: { id: string; token: string };
let bob: { id: string; token: string };

/** What the fake model was called with, to check what reaches the provider. */
const modelCalls: LanguageModelV3CallOptions[] = [];

const fakeModel = new MockLanguageModelV3({
  doStream: async (options) => {
    modelCalls.push(options);
    return {
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Hmph. " },
          { type: "text-delta", id: "t1", delta: "Fine." },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: 1,
                noCache: 1,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 2, text: 2, reasoning: 0 },
            },
          },
        ],
      }),
    };
  },
});

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  lissie = await import("./lissie");
  lissie.setLissieModelForTests(fakeModel);
  ({ handleCopilotRequest: handle } = await import("./copilot-runtime"));
  for (const name of ["alice", "bob"] as const) {
    const user = await helpers.saveUser(helpers.createUser({ name }));
    const { token } = await helpers.login({ userId: user.id });
    if (name === "alice") alice = { id: user.id, token };
    else bob = { id: user.id, token };
  }
});

afterAll(() => tearDown?.());

const BASE = "http://localhost:3000/api/copilotkit";

function req(
  method: string,
  path: string,
  {
    token,
    body,
    headers,
  }: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const h = new Headers(headers);
  if (token) h.set("authorization", `Bearer ${token}`);
  if (body !== undefined) h.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const runInput = (
  threadId: string,
  text: string,
  id = crypto.randomUUID(),
) => ({
  threadId,
  runId: crypto.randomUUID(),
  messages: [{ id, role: "user", content: text }],
  tools: [],
  context: [],
  state: {},
  forwardedProps: {},
});

/** Parses an SSE body into AG-UI events. */
async function events(
  response: Response,
): Promise<{ type: string; [k: string]: unknown }[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
}

// method, path, body-or-undefined: every route the runtime serves (see tech-docs/agent.md).
const someThread = "lissie-someone-else";
const ALL_ROUTES: [string, string, unknown?][] = [
  ["GET", "/info"],
  ["GET", "/inspector-metadata"],
  ["GET", "/inspector-learning"],
  ["POST", "/transcribe", {}],
  ["GET", "/cpk-debug-events"],
  ["POST", "/agent/lissie/run", runInput(someThread, "hi")],
  ["POST", "/agent/lissie/suggest", runInput(someThread, "hi")],
  ["POST", "/agent/lissie/connect", runInput(someThread, "hi")],
  ["POST", `/agent/lissie/stop/${someThread}`, {}],
  ["POST", "/trajectory/x/connect", {}],
  ["GET", "/threads"],
  ["POST", "/threads/subscribe", {}],
  ["GET", `/threads/${someThread}/messages`],
  ["GET", `/threads/${someThread}/events`],
  ["GET", `/threads/${someThread}/state`],
  ["POST", `/threads/${someThread}/archive`, {}],
  ["POST", "/threads/clear", {}],
  ["PATCH", `/threads/${someThread}`, {}],
  ["DELETE", `/threads/${someThread}`],
  ["GET", "/memories"],
  ["POST", "/memories/recall", {}],
  ["POST", "/memories/subscribe", {}],
  ["PATCH", "/memories/m1", {}],
  ["DELETE", "/memories/m1"],
  ["POST", "/annotate", {}],
];

describe("authentication", () => {
  test.each(ALL_ROUTES)(
    "%s %s without a session is 401",
    async (method, path, body) => {
      const response = await handle(req(method, path, { body }));
      expect(response.status).toBe(401);
    },
  );

  test.each(ALL_ROUTES)(
    "%s %s with an invalid token is 401",
    async (method, path, body) => {
      const response = await handle(req(method, path, { token: "nope", body }));
      expect(response.status).toBe(401);
    },
  );
});

describe("authorization: deny by default", () => {
  const allowedForOwnThread = new Set(["/info"]);
  test.each(ALL_ROUTES.filter(([, path]) => !allowedForOwnThread.has(path)))(
    "%s %s on someone else's or no thread is 404",
    async (method, path, body) => {
      const response = await handle(
        req(method, path, { token: alice.token, body }),
      );
      expect(response.status).toBe(404);
    },
  );

  test("info is allowed and lists only Lissie", async () => {
    const response = await handle(req("GET", "/info", { token: alice.token }));
    expect(response.status).toBe(200);
    expect(Object.keys((await response.json()).agents)).toEqual(["lissie"]);
  });

  test("another agent id is 404 even on the user's own thread", async () => {
    const own = lissie.lissieThreadId(alice.id);
    const response = await handle(
      req("POST", "/agent/other/run", {
        token: alice.token,
        body: runInput(own, "hi"),
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe("Lissie on the user's own thread", () => {
  test("run streams AG-UI events and keeps the conversation in Mastra memory, per user", async () => {
    const own = lissie.lissieThreadId(alice.id);
    const response = await handle(
      req("POST", "/agent/lissie/run", {
        token: alice.token,
        body: runInput(own, "Good morning, Lissie."),
      }),
    );
    expect(response.status).toBe(200);
    const types = (await events(response)).map((e) => e.type);
    expect(types[0]).toBe("RUN_STARTED");
    expect(types).toContain("TEXT_MESSAGE_CONTENT");
    expect(types.at(-1)).toBe("RUN_FINISHED");

    const history = await lissie.loadLissieHistory(alice.id);
    expect(history.map((m) => [m.role, m.content])).toEqual([
      ["user", "Good morning, Lissie."],
      ["assistant", "Hmph. Fine."],
    ]);
    expect(await lissie.loadLissieHistory(bob.id)).toEqual([]);
  });

  test("Bob can't run, connect to, suggest on, or stop Alice's thread", async () => {
    const alicesThread = lissie.lissieThreadId(alice.id);
    for (const [method, path, body] of [
      ["POST", "/agent/lissie/run", runInput(alicesThread, "show me her chat")],
      ["POST", "/agent/lissie/connect", runInput(alicesThread, "")],
      ["POST", "/agent/lissie/suggest", runInput(alicesThread, "")],
      ["POST", `/agent/lissie/stop/${alicesThread}`, {}],
      ["GET", `/threads/${alicesThread}/messages`, undefined],
      ["GET", `/threads/${alicesThread}/events`, undefined],
    ] as const) {
      const response = await handle(
        req(method, path, { token: bob.token, body }),
      );
      expect(response.status, `${method} ${path}`).toBe(404);
    }
  });

  test("after a restart, connect replays the conversation from Mastra memory", async () => {
    new InMemoryAgentRunner().clearThreads(); // what a server restart does to the runtime's store
    const own = lissie.lissieThreadId(alice.id);
    const response = await handle(
      req("POST", "/agent/lissie/connect", {
        token: alice.token,
        body: runInput(own, ""),
      }),
    );
    expect(response.status).toBe(200);
    const snapshot = (await events(response)).find(
      (e) => e.type === "MESSAGES_SNAPSHOT",
    );
    expect(snapshot).toBeDefined();
    const messages = (snapshot?.messages ?? []) as { content: string }[];
    expect(messages.map((m) => m.content)).toEqual([
      "Good morning, Lissie.",
      "Hmph. Fine.",
    ]);
  });

  test("the user's token and x- headers never reach the model provider", async () => {
    modelCalls.length = 0;
    const own = lissie.lissieThreadId(bob.id);
    const response = await handle(
      req("POST", "/agent/lissie/run", {
        token: bob.token,
        body: runInput(own, "Hello"),
        headers: { "x-secret": "do-not-forward" },
      }),
    );
    await response.text();
    expect(modelCalls.length).toBeGreaterThan(0);
    const sent = JSON.stringify(
      modelCalls.map((c) => c.headers ?? {}),
    ).toLowerCase();
    expect(sent).not.toContain(bob.token.toLowerCase());
    expect(sent).not.toContain("authorization");
    expect(sent).not.toContain("do-not-forward");
  });
});
