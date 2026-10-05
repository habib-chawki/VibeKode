# Architecture

todo-cat has one piece of business logic, the todo service, and several thin adapters
around it. Hexagonal (ports and adapters), without the ceremony.

```
 browser pages ─┐
 REST /api/todos ┤                       ┌──────────────┐
 agent tools  ───┼── getUserId(headers) ─▶ todo service ├──▶ lib/db.ts ──▶ SQLite
 MCP over HTTP ──┘                       └──────┬───────┘
                                                │ types and schemas
 CLI and stdio MCP ──▶ REST /api/todos     contract/ (@todo-cat/contract, zod)
```

## The todo service

- One module, `lib/todo-service.ts`, holds every todo query and rule. Nothing else
  touches the `todos` table.
- Use cases, not tables: list (filter by status open/done/all and by text), get, add,
  update (title, due date, done), delete.
- **Every function takes the user id first, and every query filters by it.** There is
  no function that reads or writes todos without an owner.
- Another user's todo is "not found", never "forbidden": the API must not reveal that
  an id exists.
- The service returns contract types (plain objects, dates as ISO strings), never
  Drizzle rows.
- Rule violations are a few typed errors with stable codes (`todo-not-found`,
  `validation-failed`). Adapters map them; they don't invent their own.

## Data

- `todos`: id, owner (user id, cascade delete with the user), title, optional due date,
  done, created at, completed at.
- A due date is a date without time and stays an ISO `yyyy-mm-dd` string everywhere.
  A JavaScript `Date` is midnight UTC and shows the previous day west of Greenwich.
- `completed at` is set when a todo is marked done and cleared when it's reopened.

## The contract

- The `contract/` workspace (`@todo-cat/contract`) holds the zod schemas for todos,
  inputs, list filters, and the error body `{ error: { code, message } }`.
- Server and clients import the same schemas. The CLI parses every response with
  them, so a server change that breaks the shape fails loudly in the client.
- Validation lives in the schemas, at the adapter boundary. The service trusts its
  typed input but always enforces ownership.

## Adapters

- An adapter does four things: parse the input with a contract schema, resolve the
  user with `getUserId` (from `lib/session.ts`), call the service, map errors to its
  protocol. No business rules in adapters.
- **REST** (`/api/todos`): for non-browser clients. Bearer token or session cookie,
  401 `unauthorized` without either, 404 `todo-not-found`, 400 `validation-failed`.
- **CLI** (`cli/`): a client of the REST API, never of the database.
- **Agent tools** (later): call the service directly. The user id comes from the
  server session, never from a tool argument the model fills in.
- **MCP**: over stdio inside the CLI (a REST client again), over HTTP inside the app
  (calls the service, like the REST routes).

## Where it lives

- Built so far: the service, the contract, the REST adapter and the CLI. The pages only show the signed-in user (no todos yet); agent tools and MCP don't exist yet.
- Service: `lib/todo-service.ts` (`listTodos`, `getTodo`, `addTodo`, `updateTodo`, `deleteTodo`, `TodoError`).
- Table: `lib/todo-schema.ts`, re-exported from `lib/schema.ts`; migrations under `drizzle/`.
- Contract: `contract/src/index.ts`, imported as `@todo-cat/contract`.
- REST adapter: `app/api/todos/` with shared plumbing in `lib/rest.ts` (see `rest-api.md`).
- CLI: `cli/`, a REST client (see `cli.md`).
- Dev seed: `lib/seed-demo.ts`, run by `npm run db:seed` (`scripts/db-seed.mts`), and it goes through Better Auth and the service like any adapter.

## Decisions and gotchas

- Ids are random UUIDs (`crypto.randomUUID()`): unguessable, but long to type; the CLI takes full ids only.
- The service throws only `todo-not-found` (`TodoError`); `validation-failed` comes from contract parsing in the adapters (`lib/rest.ts`, the CLI).
- `list` defaults to open todos; `done` and `all` are explicit.
- List order: open before done, then due date ascending with undated last, then creation time.
- Text search uses SQLite `LIKE` with `%` and `_` escaped; it is case-insensitive for ASCII letters only.
- Service functions take an optional last `clock` (`{ now }`) used only by tests and the seed; adapters never pass it.
- Marking a done todo done again keeps its first `completedAt`.
- SQLite enforces the `todos` → `user` cascade (libsql enables foreign keys); a test covers it.

## Deliberately not done

- No generic repository, unit of work, or DI container. The service module is the seam;
  tests run it against a temp SQLite file.
- No pagination, sharing between users, soft delete, or optimistic concurrency.

## Tests

- The service is tested against a temp database with **two users for every use case**:
  one user never sees, changes, or deletes the other's todos.
- Adapter tests cover only the mapping: 401 without a user, error codes, status codes.
- `lib/todo-service.test.ts` is that suite; `lib/test-support.ts` sets up the temp database and test users.
