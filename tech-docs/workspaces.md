# Workspaces

## Layout

- The repo root is both the Next.js web app and the npm workspace root (`workspaces` in `package.json`).
- `contract/` (package `@todo-cat/contract`) holds the zod schemas and types shared by the web app and the CLI (`contract/src/index.ts`).
- `cli/` (package `todo-cat-cli`) holds the `todo-cat` command-line client, bundled with esbuild (see `cli.md`).

## Why the workspaces exist before their content

- The web app and the CLI must agree on the shape of to-dos and API payloads, so that agreement gets one home (`contract/`) instead of being duplicated and drifting.
- Fixing the package boundaries up front means the first schema or CLI command lands in the right place instead of inside `app/` and being moved later.
- One root `package-lock.json` and one `npm install` cover all packages, and npm links `@todo-cat/contract` into `node_modules` so the app and CLI import it by name.

## Gotchas

- `contract/` ships TypeScript source (`exports` points at `src/index.ts`) with no build step: Turbopack transpiles workspace packages, and Vitest and tsc read the source directly.
- Its own dependencies (only `zod`, pinned) live in `contract/package.json`, so the CLI gets them too.

- Add a dependency to a workspace with `npm install <pkg> -w contract` (or `-w cli`); without `-w` it lands in the root app's `package.json`.
