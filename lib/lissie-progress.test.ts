// @vitest-environment node
import { A2uiMessageListSchema } from "@a2ui/web_core/v0_9";
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, expect, test } from "vitest";
import { lissieCatalog } from "@/app/lissie-catalog";
import { PROGRESS_SURFACE_ID } from "./lissie-progress-card";
import { setUpTestDatabase } from "./test-support";

// showProgress on a temp database: well-formed A2UI for Lissie's catalog, numbers that
// match the user's rows, and a component tree that never carries a number itself.

let progress: typeof import("./lissie-progress");
let service: typeof import("./todo-service");
let helpers: TestHelpers;
let tearDown: () => void;
let alice: string;
let bob: string;

type Component = { id: string; component: string } & Record<string, unknown>;
type Operation = {
  version: string;
  createSurface?: { surfaceId: string; catalogId: string };
  updateComponents?: { surfaceId: string; components: Component[] };
  updateDataModel?: { surfaceId: string; path: string; value: unknown };
};
type Result = {
  total: number;
  done: number;
  open: number;
  a2ui_operations: Operation[];
};

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  progress = await import("./lissie-progress");
  service = await import("./todo-service");
  alice = (await helpers.saveUser(helpers.createUser({ name: "Alice" }))).id;
  bob = (await helpers.saveUser(helpers.createUser({ name: "Bob" }))).id;
});

afterAll(() => tearDown?.());

/** Calls the tool the way Mastra does, with the session user in the reserved key. */
async function showProgressAs(userId: string): Promise<Result> {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  const execute = progress.showProgressTool.execute;
  if (!execute) throw new Error("tool without execute");
  return (await execute({} as never, { requestContext } as never)) as Result;
}

const opOf = <K extends keyof Operation>(ops: Operation[], key: K) => {
  const found = ops.filter((op) => op[key]);
  expect(found).toHaveLength(1);
  return found[0][key] as NonNullable<Operation[K]>;
};

test("the operations are well-formed A2UI v0.9 for Lissie's catalog", async () => {
  await service.addTodo(alice, { title: "Buy milk" });
  const { a2ui_operations: ops } = await showProgressAs(alice);

  expect(() => A2uiMessageListSchema.parse(ops)).not.toThrow();
  expect(opOf(ops, "createSurface").catalogId).toBe(lissieCatalog.id);
  // createSurface comes first: the client drops operations for an unknown surface.
  expect(ops[0].createSurface).toBeDefined();
  for (const op of ops) {
    const body = op.createSurface ?? op.updateComponents ?? op.updateDataModel;
    expect(body?.surfaceId).toBe(PROGRESS_SURFACE_ID);
  }

  const { components } = opOf(ops, "updateComponents");
  const ids = new Set(components.map((c) => c.id));
  expect(ids.size).toBe(components.length);
  expect(ids).toContain("root");
  for (const component of components) {
    // Every component exists in the catalog the browser renders with, props included.
    const api = lissieCatalog.components.get(component.component);
    expect(api, component.component).toBeDefined();
    const { id: _id, component: _name, ...props } = component;
    const parsed = api?.schema.safeParse(props);
    expect(parsed?.success, `${component.id}: ${parsed?.error}`).toBe(true);
    // And every child it names exists.
    const refs = [component.child, component.children].flat().filter(Boolean);
    for (const ref of refs) expect(ids).toContain(ref);
  }
});

test("the numbers match the session user's rows, and only theirs", async () => {
  const milk = (await service.listTodos(alice))[0];
  await service.updateTodo(alice, milk.id, { done: true });
  await service.addTodo(alice, { title: "Feed the cat" });
  await service.addTodo(alice, { title: "Vacuum", dueDate: "2026-10-09" });
  await service.addTodo(bob, { title: "Bob's secret" });
  const rows = await service.listTodos(alice, { status: "all" });
  const expected = {
    total: rows.length,
    done: rows.filter((t) => t.done).length,
    open: rows.filter((t) => !t.done).length,
  };
  expect(expected).toEqual({ total: 3, done: 1, open: 2 });

  const result = await showProgressAs(alice);
  expect({
    total: result.total,
    done: result.done,
    open: result.open,
  }).toEqual(expected);
  const model = opOf(result.a2ui_operations, "updateDataModel");
  expect(model).toMatchObject({ path: "/", value: expected });
});

test("the tree carries bindings, never numbers", async () => {
  const forAlice = await showProgressAs(alice);
  const forBob = await showProgressAs(bob);
  expect(forBob).toMatchObject({ total: 1, done: 0, open: 1 });
  const tree = (r: Result) => opOf(r.a2ui_operations, "updateComponents");
  // Different lists, identical trees: the numbers live in the data model only.
  expect(tree(forBob)).toEqual(tree(forAlice));
  const json = JSON.stringify(tree(forAlice));
  expect(json).not.toMatch(/:\s*-?\d/);

  // Every binding points at a value the data model has.
  const model = opOf(forAlice.a2ui_operations, "updateDataModel")
    .value as Record<string, unknown>;
  const paths = [
    ...json.matchAll(/"path":"\/(\w+)"/g),
    ...json.matchAll(/\$\{\/(\w+)\}/g),
  ].map((m) => m[1]);
  expect(new Set(paths)).toEqual(new Set(["done", "total", "open"]));
  for (const path of paths) expect(model).toHaveProperty(path);
});

test("the model gets the numbers, not the component tree", async () => {
  const result = await showProgressAs(alice);
  expect(progress.showProgressTool.toModelOutput?.(result)).toEqual({
    type: "json",
    value: { total: 3, done: 1, open: 2 },
  });
});
