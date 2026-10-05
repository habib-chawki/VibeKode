// @vitest-environment node
import {
  ErrorBodySchema,
  TodoListSchema,
  TodoSchema,
} from "@todo-cat/contract";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setUpTestDatabase } from "@/lib/test-support";

type Collection = typeof import("./route");
type Item = typeof import("./[id]/route");

let collection: Collection;
let item: Item;
let authPOST: typeof import("../auth/[...all]/route").POST;
let helpers: TestHelpers;
let tearDown: () => void;

beforeAll(async () => {
  ({ helpers, tearDown } = await setUpTestDatabase());
  collection = await import("./route");
  item = await import("./[id]/route");
  ({ POST: authPOST } = await import("../auth/[...all]/route"));
});

afterAll(() => tearDown?.());

const BASE = "http://localhost:3000";

function request(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** A real bearer token: sign up over HTTP and read the bearer plugin's header. */
async function signUp(email: string) {
  const response = await authPOST(
    request("POST", "/api/auth/sign-up/email", {
      body: { name: email, email, password: "correct horse battery" },
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  return token as string;
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = ErrorBodySchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body;
}

const someId = "3f2b9c1e-0000-4000-8000-000000000000";

// Every endpoint, called with a given token (or none).
const endpoints: [string, (token?: string) => Promise<Response>][] = [
  [
    "GET /api/todos",
    (token) => collection.GET(request("GET", "/api/todos", { token })),
  ],
  [
    "POST /api/todos",
    (token) =>
      collection.POST(
        request("POST", "/api/todos", { token, body: { title: "x" } }),
      ),
  ],
  [
    "GET /api/todos/:id",
    (token) =>
      item.GET(request("GET", `/api/todos/${someId}`, { token }), ctx(someId)),
  ],
  [
    "PATCH /api/todos/:id",
    (token) =>
      item.PATCH(
        request("PATCH", `/api/todos/${someId}`, {
          token,
          body: { done: true },
        }),
        ctx(someId),
      ),
  ],
  [
    "DELETE /api/todos/:id",
    (token) =>
      item.DELETE(
        request("DELETE", `/api/todos/${someId}`, { token }),
        ctx(someId),
      ),
  ],
];

describe("401 without a valid user", () => {
  test.each(endpoints)("%s without a token", async (_name, call) => {
    await expectError(await call(), 401, "unauthorized");
  });

  test.each(endpoints)("%s with an invalid token", async (_name, call) => {
    await expectError(await call("not-a-real-token"), 401, "unauthorized");
  });

  test("bad input without a token is still 401, not 400", async () => {
    const response = await collection.POST(
      request("POST", "/api/todos", { body: "{not json" }),
    );
    await expectError(response, 401, "unauthorized");
  });
});

test("the whole flow with a real bearer token", async () => {
  const token = await signUp("flow@example.com");

  const created = await collection.POST(
    request("POST", "/api/todos", {
      token,
      body: { title: "  Brush Lissie ", dueDate: "2026-10-09" },
    }),
  );
  expect(created.status).toBe(201);
  const todo = TodoSchema.parse(await created.json());
  expect(todo).toMatchObject({
    title: "Brush Lissie",
    dueDate: "2026-10-09",
    done: false,
  });
  expect(created.headers.get("location")).toBe(`/api/todos/${todo.id}`);

  const list = async (query = "") => {
    const response = await collection.GET(
      request("GET", `/api/todos${query}`, { token }),
    );
    expect(response.status).toBe(200);
    return TodoListSchema.parse(await response.json()).map((t) => t.id);
  };
  expect(await list()).toEqual([todo.id]);

  const patched = await item.PATCH(
    request("PATCH", `/api/todos/${todo.id}`, { token, body: { done: true } }),
    ctx(todo.id),
  );
  expect(patched.status).toBe(200);
  const done = TodoSchema.parse(await patched.json());
  expect(done.done).toBe(true);
  expect(done.completedAt).not.toBeNull();

  expect(await list()).toEqual([]);
  expect(await list("?status=done")).toEqual([todo.id]);
  expect(await list("?status=all&q=brush")).toEqual([todo.id]);
  expect(await list("?status=all&q=vacuum")).toEqual([]);

  const fetched = await item.GET(
    request("GET", `/api/todos/${todo.id}`, { token }),
    ctx(todo.id),
  );
  expect(TodoSchema.parse(await fetched.json())).toEqual(done);

  const deleted = await item.DELETE(
    request("DELETE", `/api/todos/${todo.id}`, { token }),
    ctx(todo.id),
  );
  expect(deleted.status).toBe(204);
  expect(await deleted.text()).toBe("");
  await expectError(
    await item.GET(
      request("GET", `/api/todos/${todo.id}`, { token }),
      ctx(todo.id),
    ),
    404,
    "todo-not-found",
  );
});

test("a session cookie works as well as a bearer token", async () => {
  const user = await helpers.saveUser(helpers.createUser());
  const headers = await helpers.getAuthHeaders({ userId: user.id });
  const response = await collection.GET(
    new Request(`${BASE}/api/todos`, { headers }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

describe("404 for another user's todo", () => {
  test("get, update and delete answer like the id doesn't exist", async () => {
    const owner = await signUp("owner@example.com");
    const intruder = await signUp("intruder@example.com");
    const created = await collection.POST(
      request("POST", "/api/todos", {
        token: owner,
        body: { title: "Owner's" },
      }),
    );
    const { id } = TodoSchema.parse(await created.json());

    const unknown = await expectError(
      await item.GET(
        request("GET", `/api/todos/${someId}`, { token: intruder }),
        ctx(someId),
      ),
      404,
      "todo-not-found",
    );
    const calls = [
      item.GET(
        request("GET", `/api/todos/${id}`, { token: intruder }),
        ctx(id),
      ),
      item.PATCH(
        request("PATCH", `/api/todos/${id}`, {
          token: intruder,
          body: { title: "Mine now" },
        }),
        ctx(id),
      ),
      item.DELETE(
        request("DELETE", `/api/todos/${id}`, { token: intruder }),
        ctx(id),
      ),
      item.GET(
        request("GET", "/api/todos/not-even-a-uuid", { token: intruder }),
        ctx("not-even-a-uuid"),
      ),
    ];
    for (const response of await Promise.all(calls)) {
      expect(await expectError(response, 404, "todo-not-found")).toEqual(
        unknown,
      );
    }

    const stillThere = await item.GET(
      request("GET", `/api/todos/${id}`, { token: owner }),
      ctx(id),
    );
    expect(TodoSchema.parse(await stillThere.json()).title).toBe("Owner's");
  });
});

describe("400 validation-failed for invalid input", () => {
  let token: string;
  let id: string;

  beforeAll(async () => {
    token = await signUp("validation@example.com");
    const created = await collection.POST(
      request("POST", "/api/todos", { token, body: { title: "Valid" } }),
    );
    id = TodoSchema.parse(await created.json()).id;
  });

  test.each([
    ["a body that isn't JSON", "{not json"],
    ["an empty title", { title: "   " }],
    ["an impossible due date", { title: "x", dueDate: "2026-02-30" }],
    ["a due date with a time", { title: "x", dueDate: "2026-10-09T10:00:00Z" }],
  ])("POST with %s", async (_name, body) => {
    const response = await collection.POST(
      request("POST", "/api/todos", { token, body }),
    );
    const { error } = await expectError(response, 400, "validation-failed");
    expect(error.message.length).toBeGreaterThan(0);
  });

  test.each([
    ["an empty patch", {}],
    ["done that isn't a boolean", { done: "yes" }],
  ])("PATCH with %s", async (_name, body) => {
    const response = await item.PATCH(
      request("PATCH", `/api/todos/${id}`, { token, body }),
      ctx(id),
    );
    await expectError(response, 400, "validation-failed");
  });

  test("GET with an unknown status filter", async () => {
    const response = await collection.GET(
      request("GET", "/api/todos?status=later", { token }),
    );
    await expectError(response, 400, "validation-failed");
  });
});
