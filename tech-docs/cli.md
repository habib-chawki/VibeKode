# CLI

`todo-cat` (workspace `cli/`, package `todo-cat-cli`) is a client of the REST API (`rest-api.md`), never of the database. Its main users are AI agents working for a human; humans use it too. Run it as `npx todo-cat` from the repo root.

## Layout

- `cli/src/main.ts` holds the commands (commander 15), one per REST use case plus `login`, `logout` and `whoami`; `npx todo-cat --help` lists them with examples and exit codes.
- `cli/src/api.ts` parses every response with a contract schema; `cli/src/login.ts` declares Better Auth's device-flow shapes itself, because they aren't our contract.
- `npm run build -w cli` bundles everything (contract, zod, commander) with esbuild into `cli/dist/todo-cat.js`; `cli/bin/todo-cat.js` is a committed shim that loads it.

## Built for agents

- Results on stdout (`--json` for JSON), progress and errors on stderr; error codes are the API's plus a few of the CLI's own; exit codes are fixed in `cli/src/errors.ts` and printed by `--help`.
- It never prompts and never opens a browser; destructive commands need `--yes`, and input is validated locally with the same contract schemas the server uses.

## Login and credentials

- `login` posts to `/api/auth/device/code` with client id `todo-cat-cli` (`CLI_CLIENT_ID` in the contract; the server's `validateClient` accepts only it), prints the URL and code on stderr, and polls `/api/auth/device/token` at the server's interval.
- The human approves on `/device` (`app/device/`), signing in first if needed; `/login?next=` brings them back (`lib/safe-next.ts` allows local paths only).
- The token is a Better Auth session token, sent as `Authorization: Bearer`; `whoami` and login confirmation use `GET /api/me`.
- Credentials live in `$XDG_CONFIG_HOME/todo-cat/credentials.json` (default `~/.config`, `%APPDATA%` on Windows, `TODO_CAT_CONFIG_DIR` overrides), file 0600 in a 0700 directory, keyed by server URL so a token only goes to the server that issued it; the token is never printed.
- `logout` deletes the local entry and revokes the session with `POST /api/auth/sign-out`.
- The server is `http://localhost:3000` unless `TODO_CAT_URL` is set.

## Skill for agents

- `.claude/skills/todo-cat-cli/SKILL.md` teaches agents the workflows `--help` can't: check `whoami` first and never work around a missing login, look ids up by title, answer questions with `--json` and jq, pick the right date field, delete only on request.
- It defers to `--help`; when a command, option or exit code changes here, update the skill in the same change.
- It was evaluated with two realistic requests run by subagents that had only the skill and a shell.

## Testing

- `cli/test/cli.test.ts` builds the CLI, starts `next dev` on a free port with a temp database and `NEXT_DIST_DIR=.next-cli`, points `XDG_CONFIG_HOME` at a temp folder, and runs login (code approved over HTTP with a test-utils session cookie), whoami, add, list, done, delete, logout, and whoami failing; it also checks file modes, server-side revocation, and that the token never appears in output.
- `e2e/device.spec.ts` covers the browser side: `/device` signed out → sign-up with `next` → continue → approve → the poll gets a token.
- The QA script builds the CLI in its own `cli-build` section.

## Gotchas

- npm links a workspace bin only if the file exists at install time, hence the committed shim; after adding a bin to an existing checkout, run `npm rebuild todo-cat-cli` (a plain `npm install` thinks nothing changed).
- The first `next dev` with `.next-cli` adds its type folders (including an odd `.next-cli/dev/dev/types`) to `tsconfig.json`; they're committed so the test leaves the file alone.
- Login takes at least one polling interval (5 s), so the end-to-end test needs generous timeouts.
- Agents pipe output into `head`; stdout ignores `EPIPE` and exits 0 instead of crashing with a stack trace.
