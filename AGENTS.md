<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude (an AI agent, coming later).
Next.js 16 App Router at the repo root with email and password sign-in, a per-user todo service and its REST API, plus npm workspaces `contract/` (shared zod schemas) and `cli/` (the `todo-cat` CLI, a REST client).

## Commands

Run from the repo root.

- `npm install` installs the root app and both workspaces.
- `npm run dev` starts the dev server on http://localhost:3000.
- `npm run build` builds the app for production; `npm run start` serves that build.
- `npm test` runs the Vitest unit and integration tests once.
- `npm run test:e2e` runs the Playwright end-to-end tests (Chromium, own dev server on a free port).
- `npm run lint` runs `biome check` (lint, format and import order); warnings count as errors.
- `npm run format` rewrites files with the Biome formatter.
- `npm run typecheck` type-checks the app and every workspace.
- `npm run qa` runs the QA script (`scripts/qa.sh`): Biome, typecheck, build (app and CLI), Vitest, Playwright.
- `npm run build -w cli` builds the CLI; `npx todo-cat --help` runs it against `TODO_CAT_URL` (default http://localhost:3000).
- `npm run db:generate` writes a migration from `lib/schema.ts`; `npm run db:migrate` applies pending migrations to `DATABASE_URL`.
- `npm run db:reset` deletes the local database file and migrates a fresh one.
- `npm run db:seed` resets the demo user `demo@todo-cat.dev` (password `cat-person-2026`) to a dozen todos.
- `npm run auth:generate` regenerates `lib/auth-schema.ts` from the Better Auth config; follow it with `npm run db:generate`.

## Definition of done

- Run `npm run qa` before you call a task done; it must end with `QA PASSED`.
- When a section fails, fix the code; never silence the finding by disabling a rule, skipping a test, or loosening a config.
- CI runs the same script on every push and pull request, so local green means CI green.

## Verify, don't recall

- Next.js, React, Tailwind, TypeScript, Biome and Drizzle here are newer than your training data.
- Check APIs against current docs before writing code, not against memory; when docs and installed types disagree, the installed types win.

## Researching docs

- Next.js: `node_modules/next/dist/docs/`, exact for the installed version.
- Libraries with a vendor `llms.txt` (Drizzle: https://orm.drizzle.team/llms.txt, full text at `llms-full.txt`): start there and follow its links.
- Better Auth: https://better-auth.com/llms.txt, then the per-page `.md` docs it links to.
- Mastra and CopilotKit: the installed skills in `.claude/skills/`, the vendors' own playbooks.
- Anything else: the `ctx7` CLI from the `find-docs` skill (`npx ctx7@latest library <name> "<query>"`).
- Then confirm signatures in the installed package's `.d.ts` files under `node_modules/`.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Current state only: delete outdated content instead of adding caveats.

Index:

- [architecture.md](tech-docs/architecture.md) — the todo service, the contract, and the thin adapters around them; read before adding a feature.
- [workspaces.md](tech-docs/workspaces.md) — the npm workspace layout and why it exists before its content does.
- [testing.md](tech-docs/testing.md) — test strategy, the QA script, CI, and the gotchas of running e2e next to `npm run dev`.
- [database.md](tech-docs/database.md) — Drizzle on SQLite, the single `lib/db.ts` seam, migrations, and per-run temp databases.
- [rest-api.md](tech-docs/rest-api.md) — the `/api/todos` endpoints, status codes, and getting a bearer token with curl.
- [cli.md](tech-docs/cli.md) — the `todo-cat` CLI: commands, exit codes, device login, credentials, and its end-to-end test.
- [auth.md](tech-docs/auth.md) — Better Auth, the `lib/session.ts` seam every adapter uses, the generated schema, and the auth UI.

## Keeping this map current

- When a change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update both in the same change.
- Prefer deleting over adding, pointers over prose, one sentence per bullet.
