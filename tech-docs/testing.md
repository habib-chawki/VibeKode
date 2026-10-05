# Testing

## Strategy

- The harness exists before any feature, so every feature arrives with its tests and agents get a feedback loop from the first change.
- Vitest (`vitest.config.mts`) runs unit and integration tests in jsdom; test files sit next to the code as `*.test.ts(x)`.
- Playwright (`playwright.config.mts`) runs end-to-end tests from `e2e/` in Chromium only, against a dev server it starts itself.
- Async Server Components can't render in Vitest; cover them with an e2e test instead.

## Commands

- `npm test` runs Vitest once; `npm run test:watch` keeps it watching.
- `npm run test:e2e` runs Playwright; `npx playwright show-trace` opens a trace from `test-results/` after a CI retry.

## Gotchas

- Next 16 locks its dist dir, so a second `next dev` in the same folder refuses to start; the e2e server builds into `.next-e2e/` via `NEXT_DIST_DIR` (read in `next.config.ts`).
- Playwright asks the OS for a free port and passes it to its workers through `E2E_PORT`; set `E2E_PORT` or `E2E_DIST_DIR` to pin them, e.g. for a second checkout.
- `reuseExistingServer` is off on purpose: e2e tests must never run against a developer's `npm run dev`.
- The first `next dev` with `.next-e2e/` adds its type folders to `tsconfig.json` and reformats the file; keep the entries and run `npm run format` so Biome passes.
- Vite resolves the `@/*` alias itself (`resolve.tsconfigPaths`); the `vite-tsconfig-paths` plugin from the Next docs isn't needed.
- Vitest runs without globals, so `vitest.setup.ts` registers Testing Library's `cleanup` explicitly.
- A Playwright upgrade needs a matching browser: `npx playwright install chromium`.
