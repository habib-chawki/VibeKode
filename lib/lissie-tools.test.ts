// @vitest-environment node
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { setUpTestDatabase } from "./test-support";

let tools: typeof import("./lissie-tools");
let service: typeof import("./todo-service");
let helpers: TestHelpers;
let tearDown: () => void;
let alice: string;
let bob: string;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  tools = await import("./lissie-tools");
  service = await import("./todo-service");
  alice = (await helpers.saveUser(helpers.createUser({ name: "Alice" }))).id;
  bob = (await helpers.saveUser(helpers.createUser({ name: "Bob" }))).id;
});

afterAll(() => tearDown?.());

/** What lib/copilot-runtime.ts does per request: the session user in the reserved key. */
function as(userId?: string) {
  const requestContext = new RequestContext();
  if (userId) requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  return { requestContext } as never;
}

type Executable = {
  execute?: (input: never, context: never) => unknown;
};

/** Calls a tool the way Mastra does: validated input plus the request context. */
const run = (tool: Executable, input: unknown, ctx: unknown) => {
  if (!tool.execute) throw new Error("tool without execute");
  return tool.execute(input as never, ctx as never) as Promise<
    Record<string, unknown>
  >;
};

test("addTodo adds to the session user's list only", async () => {
  const result = await run(tools.addTodoTool, { title: "Buy milk" }, as(alice));
  expect(result.todo).toMatchObject({ title: "Buy milk", done: false });
  expect((await service.listTodos(alice)).map((t) => t.title)).toEqual([
    "Buy milk",
  ]);
  expect(await service.listTodos(bob)).toEqual([]);
});

test("listTodos only ever sees the session user's todos", async () => {
  await service.addTodo(bob, { title: "Bob's secret" });
  const result = await run(tools.listTodosTool, { status: "all" }, as(alice));
  expect((result.todos as { title: string }[]).map((t) => t.title)).toEqual([
    "Buy milk",
  ]);
});

test("setTodoDone can't touch another user's todo, and says so", async () => {
  const bobs = await service.addTodo(bob, { title: "Bob's errand" });
  const result = await run(
    tools.setTodoDoneTool,
    { id: bobs.id, done: true },
    as(alice),
  );
  expect(result).toEqual({
    error: { code: "todo-not-found", message: "Todo not found." },
  });
  expect((await service.getTodo(bob, bobs.id)).done).toBe(false);
});

test("setTodoDone marks the user's own todo done and open again", async () => {
  const [milk] = await service.listTodos(alice, { q: "milk" });
  const done = await run(
    tools.setTodoDoneTool,
    { id: milk.id, done: true },
    as(alice),
  );
  expect(done.todo).toMatchObject({ done: true });
  const open = await run(
    tools.setTodoDoneTool,
    { id: milk.id, done: false },
    as(alice),
  );
  expect(open.todo).toMatchObject({ done: false, completedAt: null });
});

test("without a session user every tool refuses", async () => {
  for (const [tool, input] of [
    [tools.listTodosTool, {}],
    [tools.addTodoTool, { title: "x" }],
    [tools.setTodoDoneTool, { id: "x", done: true }],
  ] as const) {
    await expect(run(tool, input, as())).rejects.toThrow("signed-in user");
  }
});
