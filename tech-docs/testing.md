# Testing

## Strategy

- The harness existed before any feature, so every feature arrives with its tests and agents get a feedback loop from the first change.
- Vitest runs unit and integration tests next to the code (`*.test.ts(x)`): jsdom by default for components, `// @vitest-environment node` for database, auth, route handler and CLI tests.
- Playwright runs end-to-end tests from `e2e/` in Chromium only, against a dev server it starts itself.
- Tests that call the real model live in `e2e-llm/` and run only via `npm run test:chat`: slow, non-deterministic and paid, so never in QA or CI.
- Async Server Components (like `app/page.tsx`) can't render in Vitest; cover them with an e2e test instead.
- Temp databases come from `lib/test-support.ts` (see `database.md`); a test that can't fail proves nothing, so break the code once to see a new test go red.

## QA script

- `scripts/qa.sh` (`npm run qa`) is the one definition of "done" for agents, humans and CI.
- Sections run in order (Biome, typecheck, build, cli-build, Vitest, Playwright), all of them even after a failure, so one pass shows every problem.
- Output is written for agents: one `PASS`/`FAIL` line per section, only failing output printed, a summary last, no colors, exit 1 on any failure; full logs land in `.qa/<section>.log`.
- Biome runs with `--error-on-warnings`, because agents skip past warnings but not past a red section.
- `npm run typecheck` runs `next typegen` first: globals like `LayoutProps` and `next-env.d.ts` are generated, not committed, so a bare `tsc` passes locally after `next dev` but fails on a fresh checkout.

## CI

- `.github/workflows/ci.yml` runs `npm run qa` on every push and pull request with Node 24 and `npm ci`; there is no deployment.
- `.env` is generated from `.env.example` with dummy values, so every variable the app needs must have an entry there; real secrets never go into CI.
- Playwright browsers are cached by Playwright version; on failure the job uploads `.qa/` and `test-results/` as `qa-logs`, and `gh run view --log-failed` shows the same output.

## Gotchas

- Next 16 locks its dist dir, so a second `next dev` in the same folder refuses to start; each test server gets its own via `NEXT_DIST_DIR` (read in `next.config.ts`): `.next-e2e` for Playwright, `.next-cli` for the CLI test.
- The first `next dev` with a new dist dir adds its type folders to `tsconfig.json` and reformats the file; keep the entries and run `npm run format`, then a rerun leaves the file alone.
- Playwright asks the OS for a free port and a temp database per run and passes them to its workers via env (`E2E_PORT`, `E2E_DATABASE_URL`, `E2E_DIST_DIR` pin them); Next.js prefers `process.env` over `.env`, so `data/app.db` is never touched.
- `e2e/global-teardown.mts` deletes that temp database folder after the run, but never one you passed in via `E2E_DATABASE_URL`.
- `reuseExistingServer` is off on purpose: e2e tests must never run against a developer's `npm run dev`.
- Every test server needs `BETTER_AUTH_URL` set to its own URL, because Better Auth rejects requests from other origins.
- Next.js renders a hidden `role="alert"` route announcer, so scope alert locators (`page.locator("form").getByRole("alert")`).
- A hydration warning about `caret-color` comes from Playwright's `screenshot()`, not the app.
