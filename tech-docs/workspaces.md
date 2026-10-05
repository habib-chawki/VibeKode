# Workspaces

## Layout

- The repo root is both the Next.js web app and the npm workspace root (`workspaces` in `package.json`).
- `contract/` (package `@todo-cat/contract`) holds the zod schemas and types shared by the web app and the CLI.
- `cli/` (package `todo-cat-cli`) holds the `todo-cat` command-line client (see `cli.md`).

## Why

- The web app and the CLI must agree on the shape of todos and API payloads, so that agreement has one home (`contract/`) instead of being duplicated and drifting.
- One root `package-lock.json` and one `npm install` cover all packages, and npm links `@todo-cat/contract` into `node_modules` so the app and CLI import it by name.
- The workspaces were declared at scaffold time, so the QA script and CI never had to be rebuilt for a monorepo.

## Gotchas

- `contract/` ships TypeScript source (`exports` points at `src/index.ts`) with no build step: Turbopack transpiles workspace packages, and Vitest and tsc read the source; the CLI bundles it with esbuild.
- Add a dependency to a workspace with `npm install <pkg> -w contract` (or `-w cli`); without `-w` it lands in the root app's `package.json`.
- The root `tsconfig.json` covers `contract/` and `cli/`; neither has its own.
