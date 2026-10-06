<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# todo-cat

A to-do list web app kept by Lissie, a cat with attitude: a Mastra agent the user chats with on `/` through CopilotKit.
Next.js 16 App Router at the repo root with email and password sign-in, a per-user todo service and its REST API, plus npm workspaces `contract/` (shared zod schemas) and `cli/` (the `todo-cat` CLI, a REST client).

## First-time setup

- `npm install`, then `cp .env.example .env` and set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `OPENROUTER_API_KEY` (only Lissie's live replies need it); `.env` is git-ignored, so a fresh clone has none.
- `npm run db:reset` creates and migrates `data/app.db`; `npm run db:seed` adds `demo@todo-cat.dev` (password `cat-person-2026`) with a dozen todos.
- `npx playwright install chromium` before the first e2e run and after every Playwright upgrade (the browser revision must match).
- `npm run build -w cli` before `npx todo-cat`; if npx can't find it, `npm rebuild todo-cat-cli` links the bin.

## Commands

Run from the repo root; `package.json` has the full list.

- `npm run qa` runs the QA script (`scripts/qa.sh`): Biome, typecheck, app and CLI builds, Vitest, Playwright.
- `npm run dev` serves http://localhost:3000; `npm test` and `npm run test:e2e` run Vitest and Playwright alone.
- `npm run test:chat` runs the e2e tests that call the real model; they're kept out of QA and CI.
- `npm run lint` is `biome check` with warnings as errors; `npm run format` fixes formatting.
- After changing `lib/schema.ts`: `npm run db:generate`, commit the new `drizzle/` folder, `npm run db:migrate`.
- After changing Better Auth plugins or options: `npm run auth:generate`, then `npm run db:generate`.
- `npx todo-cat --help` runs the CLI against `TODO_CAT_URL` (default http://localhost:3000).

## Definition of done

- Run `npm run qa` before you call a task done; it must end with `QA PASSED`.
- When a section fails, fix the code; never silence the finding by disabling a rule, skipping a test, or loosening a config.
- CI runs the same script on a clean checkout: after touching config, types or build setup, rerun QA after `rm -rf .next .next-e2e .next-cli next-env.d.ts`, because leftover generated files once hid a CI failure.

## Verify, don't recall

- Next.js, React, Tailwind, TypeScript, Biome, Drizzle, Better Auth, Mastra, AG-UI and CopilotKit here are newer than your training data.
- Check APIs against current docs before writing code, not against memory; when docs and installed types disagree, the installed types win.

## Researching docs

- Next.js: `node_modules/next/dist/docs/`, exact for the installed version.
- Libraries with a vendor `llms.txt` (Drizzle: https://orm.drizzle.team/llms.txt, full text at `llms-full.txt`): start there and follow its links.
- Better Auth: https://better-auth.com/llms.txt, then the per-page `.md` docs it links to.
- Mastra and CopilotKit: the installed skills in `.claude/skills/`, the vendors' own playbooks.
- Anything else: the `ctx7` CLI from the `find-docs` skill (`npx ctx7@latest library <name> "<query>"`).
- Then confirm signatures in the installed package's `.d.ts` files under `node_modules/`.

## Working in this repo

- Auto mode blocks commands that download and run third-party code (`npx skills add`, `npx impeccable install`); hand those to the human instead of working around the block.
- Stop a background `next dev` by the pid listening on its port (`ss -ltnp 'sport = :3000'`); `pkill -f 'next dev'` also kills the shell that runs it.

## Tech docs

`tech-docs/` holds project-specific technical docs; agents are the primary audience.

- Describe approach, principles, design decisions with their reasons, and gotchas.
- Point to the central files instead of copying code.
- Leave out anything an agent finds out by reading the code.
- Current state only: delete outdated content instead of adding caveats.

Index:

- [architecture.md](tech-docs/architecture.md) — the todo service, the contract, and the thin adapters around them; read before adding a feature.
- [workspaces.md](tech-docs/workspaces.md) — the npm workspace layout, and how `contract/` and `cli/` are built and linked.
- [testing.md](tech-docs/testing.md) — test strategy, the QA script, CI, and the gotchas of running e2e next to `npm run dev`.
- [database.md](tech-docs/database.md) — Drizzle on SQLite, the single `lib/db.ts` seam, migrations, seeding, and per-run temp databases.
- [auth.md](tech-docs/auth.md) — Better Auth, the `lib/session.ts` seam every adapter uses, the generated schema, and device approval.
- [rest-api.md](tech-docs/rest-api.md) — the `/api/todos` endpoints, status codes, and getting a bearer token with curl.
- [agent.md](tech-docs/agent.md) — Lissie: the Mastra agent, per-user memory, the guarded CopilotKit runtime, and keeping tokens away from the model.
- [cli.md](tech-docs/cli.md) — the `todo-cat` CLI: agent conventions, device login, credentials, its skill and its end-to-end test.

## Keeping this map current

- When a change invalidates a line here or in `tech-docs/`, or teaches a costly lesson, update both in the same change.
- Prefer deleting over adding, pointers over prose, one sentence per bullet.
