import {
  CurrentUserSchema,
  NewTodoSchema,
  type Todo,
  TodoListSchema,
  TodoSchema,
  TodoStatusSchema,
  TodoUpdateSchema,
} from "@todo-cat/contract";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";
import { call, DEFAULT_SERVER, serverUrl } from "./api";
import {
  credentialsPath,
  deleteCredentials,
  loadCredentials,
  saveCredentials,
} from "./credentials";
import { CliError, EXIT, EXIT_CODE_HELP, notSignedIn } from "./errors";
import { deviceLogin, revokeSession } from "./login";

// todo-cat: a client of the REST API, for AI agents first and humans too.
// stdout carries results (text, or JSON with --json); stderr carries progress and errors.

const program = new Command("todo-cat")
  .description(
    "Lissie's to-do list from the terminal. A client of the todo-cat REST API.",
  )
  .option(
    "--json",
    "print results as JSON on stdout (errors as JSON on stderr)",
  )
  .exitOverride()
  .configureOutput({ outputError: () => {} }); // usage errors are reported by run() below

program.addHelpText(
  "after",
  `
Server: ${DEFAULT_SERVER} unless TODO_CAT_URL is set. Credentials: ${credentialsPath()}
(override the directory with TODO_CAT_CONFIG_DIR).

Examples:
  todo-cat login                       print a code and a URL, then wait for approval
  todo-cat list                        open todos
  todo-cat list --status all --search vet --json
  todo-cat add "Buy salmon treats" --due 2026-10-09
  todo-cat done <id>
  todo-cat edit <id> --title "Buy tuna treats" --no-due
  todo-cat delete <id> --yes

${EXIT_CODE_HELP}`,
);

const json = () => Boolean(program.opts().json);
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};
const say = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function token(): string {
  const saved = loadCredentials(serverUrl());
  if (!saved) throw notSignedIn();
  return saved.token;
}

/** Validate locally with the same contract schema the server uses. */
function input<T>(
  schema: {
    safeParse(v: unknown):
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: { path: PropertyKey[]; message: string }[] };
        };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues
    .map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`)
    .join("; ");
  throw new CliError("validation-failed", message, EXIT.validation);
}

function line(todo: Todo): string {
  const due = todo.dueDate ? `  due ${todo.dueDate}` : "";
  return `${todo.done ? "[x]" : "[ ]"} ${todo.title}${due}  (${todo.id})`;
}

function print(todo: Todo, verb?: string) {
  if (json()) out(JSON.stringify(todo));
  else out(verb ? `${verb}: ${line(todo)}` : line(todo));
}

const status = new Option("--status <status>", "open, done or all")
  .choices(TodoStatusSchema.options)
  .default("open");

program
  .command("list")
  .description("list todos (open ones unless --status says otherwise)")
  .addOption(status)
  .option("--search <text>", "only todos whose title contains this text")
  .action(async (opts: { status: string; search?: string }) => {
    const query = new URLSearchParams({ status: opts.status });
    if (opts.search) query.set("q", opts.search);
    const todos = await call("GET", `/api/todos?${query}`, TodoListSchema, {
      token: token(),
    });
    if (json()) {
      out(JSON.stringify(todos));
    } else if (todos.length === 0) {
      out(`No ${opts.status === "all" ? "" : `${opts.status} `}todos.`);
    } else {
      for (const todo of todos) out(line(todo));
    }
  });

program
  .command("show")
  .description("show one todo")
  .argument("<id>")
  .action(async (id: string) => {
    print(
      await call("GET", `/api/todos/${encodeURIComponent(id)}`, TodoSchema, {
        token: token(),
      }),
    );
  });

program
  .command("add")
  .description("add a todo")
  .argument("<title...>", "the title (quotes optional)")
  .option("--due <yyyy-mm-dd>", "due date")
  .action(async (words: string[], opts: { due?: string }) => {
    const body = input(NewTodoSchema, {
      title: words.join(" "),
      dueDate: opts.due,
    });
    print(
      await call("POST", "/api/todos", TodoSchema, { token: token(), body }),
      "Added",
    );
  });

program
  .command("edit")
  .description("change a todo's title or due date")
  .argument("<id>")
  .option("--title <title>", "new title")
  .option("--due <yyyy-mm-dd>", "new due date")
  .option("--no-due", "remove the due date")
  .action(
    async (id: string, opts: { title?: string; due?: string | false }) => {
      const body = input(TodoUpdateSchema, {
        title: opts.title,
        dueDate: opts.due === false ? null : opts.due,
      });
      print(await patch(id, body), "Updated");
    },
  );

const patch = (id: string, body: unknown) =>
  call("PATCH", `/api/todos/${encodeURIComponent(id)}`, TodoSchema, {
    token: token(),
    body,
  });

program
  .command("done")
  .description("mark a todo as done")
  .argument("<id>")
  .action(async (id: string) => print(await patch(id, { done: true }), "Done"));

program
  .command("reopen")
  .description("mark a done todo as open again")
  .argument("<id>")
  .action(async (id: string) =>
    print(await patch(id, { done: false }), "Reopened"),
  );

program
  .command("delete")
  .description("delete a todo for good (requires --yes)")
  .argument("<id>")
  .option("--yes", "confirm the deletion; todo-cat never asks interactively")
  .action(async (id: string, opts: { yes?: boolean }) => {
    if (!opts.yes) {
      throw new CliError(
        "usage-error",
        "Deleting needs --yes; nothing was deleted.",
        EXIT.usage,
      );
    }
    await call("DELETE", `/api/todos/${encodeURIComponent(id)}`, null, {
      token: token(),
    });
    if (json()) out(JSON.stringify({ deleted: id }));
    else out(`Deleted ${id}`);
  });

program
  .command("login")
  .description(
    "sign in through the browser, like `gh auth login` (prints a code, never opens a browser)",
  )
  .action(async () => {
    const sessionToken = await deviceLogin(say);
    const user = await call("GET", "/api/me", CurrentUserSchema, {
      token: sessionToken,
    });
    saveCredentials(serverUrl(), { token: sessionToken, email: user.email });
    if (json()) out(JSON.stringify({ user }));
    else out(`Signed in to ${serverUrl()} as ${user.email}.`);
  });

program
  .command("logout")
  .description("revoke the session on the server and forget the token")
  .action(async () => {
    const saved = loadCredentials(serverUrl());
    if (!saved) {
      if (json()) out(JSON.stringify({ signedOut: false }));
      else out("Not signed in.");
      return;
    }
    deleteCredentials(serverUrl());
    await revokeSession(saved.token);
    if (json()) out(JSON.stringify({ signedOut: true }));
    else out(`Signed out of ${serverUrl()}.`);
  });

program
  .command("whoami")
  .description("show who you're signed in as")
  .action(async () => {
    const user = await call("GET", "/api/me", CurrentUserSchema, {
      token: token(),
    });
    if (json()) out(JSON.stringify(user));
    else out(`${user.email} (${user.name}) on ${serverUrl()}`);
  });

// Commander rejects dates like any other option value through the contract, at parse time.
for (const command of program.commands) {
  for (const option of command.options) {
    if (option.long === "--due" && !option.negate) {
      option.argParser((value: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new InvalidArgumentError("expected a date as yyyy-mm-dd");
        }
        return value;
      });
    }
  }
}

function fail(error: CliError) {
  if (json()) {
    process.stderr.write(
      `${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`,
    );
  } else {
    say(`todo-cat: ${error.message}`);
  }
  process.exitCode = error.exitCode;
}

async function run() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help and --version exit 0; everything else commander rejects is a usage error.
      if (error.exitCode === 0) return;
      return fail(
        new CliError(
          "usage-error",
          `${error.message.replace(/^error: /, "")} (see todo-cat --help)`,
          EXIT.usage,
        ),
      );
    }
    if (error instanceof CliError) {
      if (
        error.exitCode === EXIT.unauthorized &&
        loadCredentials(serverUrl())
      ) {
        // The saved token was rejected: expired or revoked elsewhere.
        return fail(
          new CliError(
            "unauthorized",
            "Your session expired or was revoked. Run `todo-cat login` again.",
            EXIT.unauthorized,
          ),
        );
      }
      return fail(error);
    }
    return fail(
      new CliError(
        "unexpected",
        error instanceof Error ? error.message : String(error),
        EXIT.unexpected,
      ),
    );
  }
}

await run();
