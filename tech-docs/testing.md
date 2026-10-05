# Testing

## Strategy

- The harness exists before any feature, so every feature arrives with its tests and agents get a feedback loop from the first change.
- Vitest (`vitest.config.mts`) runs unit and integration tests in jsdom; test files sit next to the code as `*.test.ts(x)`.
- Playwright (`playwright.config.mts`) runs end-to-end tests from `e2e/` in Chromium only, against a dev server it starts itself.
- Async Server Components can't render in Vitest; cover them with an e2e test instead.

## Commands

- `npm test` runs Vitest once; `npm run test:watch` keeps it watching.
- `npm run test:e2e` runs Playwright; `npx playwright show-trace` opens a trace from `test-results/` after a CI retry.

## QA script

- `scripts/qa.sh` (`npm run qa`) is the one definition of "done" for agents, humans and CI.
- Sections run in order (Biome, typecheck, build, Vitest, Playwright) and all of them run even after a failure, so one pass shows every problem.
- Output is written for agents: one `PASS`/`FAIL` line per section, only failing output printed, a summary last, no colors, exit 1 on any failure.
- Every section's full output lands in `.qa/<section>.log` (override with `QA_LOG_DIR`).
- Biome runs with `--error-on-warnings`, because agents skip past warnings but not past a red section.
- `npm run typecheck` checks the root tsconfig (which covers `contract/` and `cli/`) plus any workspace that defines its own `typecheck` script.
- It runs `next typegen` first: globals like `LayoutProps` and `next-env.d.ts` are generated, not committed, so a bare `tsc` passes locally after `next dev` but fails on a fresh checkout.

## CI

- `.github/workflows/ci.yml` runs `npm run qa` on every push and pull request with Node 24 and `npm ci`; there is no deployment.
- `.env` is generated from `.env.example` with dummy values; real secrets never go into CI.
- Playwright browsers are cached by Playwright version; on a cache hit only the system dependencies are installed.
- On failure the job uploads `.qa/` and `test-results/` as the `qa-logs` artifact; `gh run view --log-failed` shows the same output.

## Gotchas

- Next 16 locks its dist dir, so a second `next dev` in the same folder refuses to start; the e2e server builds into `.next-e2e/` via `NEXT_DIST_DIR` (read in `next.config.ts`).
- Playwright asks the OS for a free port and passes it to its workers through `E2E_PORT`; set `E2E_PORT` or `E2E_DIST_DIR` to pin them, e.g. for a second checkout.
- The e2e server gets `DATABASE_URL` pointing at a fresh temp SQLite file per run (override with `E2E_DATABASE_URL`), migrated before `next dev` starts; Next.js prefers `process.env` over `.env`, so `data/app.db` is never touched.
- `reuseExistingServer` is off on purpose: e2e tests must never run against a developer's `npm run dev`.
- The e2e server also gets `BETTER_AUTH_URL` set to its own URL, because Better Auth rejects requests from other origins.
- Next.js renders a hidden `role="alert"` route announcer, so scope alert locators (`page.locator("form").getByRole("alert")`).
- The first `next dev` with `.next-e2e/` adds its type folders to `tsconfig.json` and reformats the file; keep the entries and run `npm run format` so Biome passes.
- Vite resolves the `@/*` alias itself (`resolve.tsconfigPaths`); the `vite-tsconfig-paths` plugin from the Next docs isn't needed.
- Vitest runs without globals, so `vitest.setup.ts` registers Testing Library's `cleanup` explicitly.
- A Playwright upgrade needs a matching browser: `npx playwright install chromium`.
