// @vitest-environment node
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  CurrentUserSchema,
  TodoListSchema,
  TodoSchema,
} from "@todo-cat/contract";
import type { TestHelpers } from "better-auth/plugins";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { setUpTestDatabase } from "../../lib/test-support";

// Drives the built CLI end to end against a real `next dev` on a spare port, with a temp
// database and a redirected config directory. Device codes are approved through Better
// Auth's test utils: a session cookie for a test user, no browser.

const root = resolve(__dirname, "../..");
const bin = join(root, "cli/bin/todo-cat.js");

let helpers: TestHelpers;
let tearDown: () => void;
let server: ChildProcess;
let url: string;
let configHome: string;
const outputs: string[] = [];

async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const s = createServer();
    s.on("error", fail);
    s.listen(0, () => {
      const address = s.address();
      s.close(() =>
        typeof address === "object" && address ? done(address.port) : fail(),
      );
    });
  });
}

async function waitForServer(target: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${target}/api/me`)).status === 401) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next dev didn't answer at ${target} within ${timeoutMs} ms`);
}

beforeAll(async () => {
  execFileSync("npm", ["run", "build", "-w", "cli", "--silent"], { cwd: root });
  ({ helpers, tearDown } = await setUpTestDatabase());
  configHome = mkdtempSync(join(tmpdir(), "todo-cat-cli-config-"));

  const port = await freePort();
  url = `http://localhost:${port}`;
  server = spawn("npx", ["next", "dev", "--port", String(port)], {
    cwd: root,
    detached: true, // own process group, so afterAll can stop next and its workers
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-cli",
      BETTER_AUTH_URL: url,
      // DATABASE_URL and BETTER_AUTH_SECRET come from setUpTestDatabase's stubs
    },
  });
  await waitForServer(url, 120_000);
}, 180_000);

afterAll(() => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  tearDown?.();
  if (configHome) rmSync(configHome, { recursive: true, force: true });
});

type Result = { code: number | null; stdout: string; stderr: string };

function todoCat(
  args: string[],
  onStderr?: (chunk: string) => void,
): Promise<Result> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: {
        ...process.env,
        TODO_CAT_URL: url,
        XDG_CONFIG_HOME: configHome,
        TODO_CAT_CONFIG_DIR: "",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      onStderr?.(String(d));
    });
    child.on("close", (code) => {
      outputs.push(stdout, stderr);
      done({ code, stdout, stderr });
    });
  });
}

/** What a human does in the browser: open /device, check the code, approve it. */
async function approveInBrowser(userCode: string, userId: string) {
  const cookie = (await helpers.getAuthHeaders({ userId })).get("cookie") ?? "";
  const headers = { cookie, origin: url, "content-type": "application/json" };
  const verify = await fetch(`${url}/api/auth/device?user_code=${userCode}`, {
    headers,
  });
  expect(verify.status).toBe(200);
  const approve = await fetch(`${url}/api/auth/device/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userCode }),
  });
  expect(approve.status).toBe(200);
}

describe("todo-cat against a real server", () => {
  let token = "";

  test("login prints a code and a URL and finishes once the code is approved", async () => {
    const user = await helpers.saveUser(
      helpers.createUser({ email: "cli@example.com", name: "CLI Human" }),
    );
    let approving: Promise<void> | undefined;
    const login = todoCat(["login"], (chunk) => {
      const match = chunk.match(/enter the code ([A-Z0-9]{4}-?[A-Z0-9]{4})/);
      if (match && !approving) {
        expect(chunk).toContain(`${url}/device`);
        approving = approveInBrowser(match[1].replace("-", ""), user.id);
      }
    });
    const result = await login;
    await approving;
    expect(result.stderr).toContain("Waiting for approval");
    expect(result).toMatchObject({ code: 0 });
    expect(result.stdout).toContain("Signed in to");
    expect(result.stdout).toContain("cli@example.com");

    const file = join(configHome, "todo-cat", "credentials.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(configHome, "todo-cat")).mode & 0o777).toBe(0o700);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    token = saved.servers[url].token;
    expect(token).toBeTruthy();
  }, 90_000);

  test("whoami shows the approving user", async () => {
    const result = await todoCat(["--json", "whoami"]);
    expect(result.code).toBe(0);
    expect(CurrentUserSchema.parse(JSON.parse(result.stdout)).email).toBe(
      "cli@example.com",
    );
  });

  test("add, list, done, delete", async () => {
    const added = await todoCat([
      "--json",
      "add",
      "Feed",
      "Lissie",
      "--due",
      "2026-10-09",
    ]);
    expect(added.code).toBe(0);
    const todo = TodoSchema.parse(JSON.parse(added.stdout));
    expect(todo).toMatchObject({
      title: "Feed Lissie",
      dueDate: "2026-10-09",
      done: false,
    });

    const open = await todoCat(["--json", "list"]);
    expect(
      TodoListSchema.parse(JSON.parse(open.stdout)).map((t) => t.id),
    ).toContain(todo.id);
    const text = await todoCat(["list"]);
    expect(text.stdout).toContain("[ ] Feed Lissie  due 2026-10-09");

    const done = await todoCat(["--json", "done", todo.id]);
    expect(TodoSchema.parse(JSON.parse(done.stdout)).done).toBe(true);
    const doneList = await todoCat(["--json", "list", "--status", "done"]);
    expect(
      TodoListSchema.parse(JSON.parse(doneList.stdout)).map((t) => t.id),
    ).toEqual([todo.id]);

    const refused = await todoCat(["delete", todo.id]);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain("--yes");
    expect((await todoCat(["show", todo.id])).code).toBe(0);

    const deleted = await todoCat(["delete", todo.id, "--yes"]);
    expect(deleted.code).toBe(0);
    const gone = await todoCat(["--json", "show", todo.id]);
    expect(gone.code).toBe(4);
    expect(JSON.parse(gone.stderr).error.code).toBe("todo-not-found");
  }, 60_000);

  test("server-side validation errors carry the API's code and exit 5", async () => {
    const result = await todoCat(["--json", "edit", "some-id"]);
    expect(result.code).toBe(5);
    expect(JSON.parse(result.stderr).error.code).toBe("validation-failed");
  });

  test("logout revokes the session on the server and forgets the token", async () => {
    const result = await todoCat(["logout"]);
    expect(result.code).toBe(0);
    expect(
      statSync(join(configHome, "todo-cat", "credentials.json"), {
        throwIfNoEntry: false,
      }),
    ).toBeUndefined();

    const revoked = await fetch(`${url}/api/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoked.status).toBe(401);

    const whoami = await todoCat(["whoami"]);
    expect(whoami.code).toBe(3);
    expect(whoami.stderr).toContain("todo-cat login");
  });

  test("never prints the token", () => {
    expect(token).toBeTruthy();
    for (const output of outputs)
      expect(output).not.toContain(token.split(".")[0]);
  });
});

test("an unreachable server exits 6 without hanging", async () => {
  const dir = mkdtempSync(join(tmpdir(), "todo-cat-unreachable-"));
  const dead = "http://127.0.0.1:9"; // discard port: nothing listens there
  writeFileSync(
    join(dir, "credentials.json"),
    JSON.stringify({
      servers: { [dead]: { token: "t", email: "x@example.com" } },
    }),
    { mode: 0o600 },
  );
  const child = spawn(process.execPath, [bin, "--json", "whoami"], {
    env: { ...process.env, TODO_CAT_URL: dead, TODO_CAT_CONFIG_DIR: dir },
  });
  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += d;
  });
  const code = await new Promise((done) => child.on("close", done));
  rmSync(dir, { recursive: true, force: true });
  expect(code).toBe(6);
  expect(JSON.parse(stderr).error.code).toBe("unreachable");
});
