# Database

## Approach

- Drizzle ORM on SQLite through `@libsql/client`; `DATABASE_URL` (a `file:` URL, `file:./data/app.db` in dev) names the database.
- `lib/db.ts` is the only module that opens the database and the only one that interprets `DATABASE_URL`; everything else imports `db` from it.
- `lib/db.ts` imports `server-only`, so a Client Component that imports it fails the build.
- The schema lives in `lib/schema.ts`: the generated auth tables (`lib/auth-schema.ts`, see `auth.md`) and the hand-written `todos` table (`lib/todo-schema.ts`, see `architecture.md`).
- Migrations are code-first: change `lib/schema.ts`, run `npm run db:generate`, commit the generated folder under `drizzle/`, run `npm run db:migrate`.

## Why

- One seam means auth, todos and agent memory share one connection and one place to change drivers or settings.
- SQLite in a file gives every test run and every e2e run its own database for free, with no server to start.
- The database is not in git (`data/` keeps only its `.gitignore`), so `npm run db:reset` is part of recovering any checkout.

## Versions

- Drizzle is pinned exactly to `1.0.0-rc.4` (`drizzle-orm` and `drizzle-kit`): the current docs describe v1, while npm `latest` is still 0.45 with a different API and migration layout.
- v1 migrations are one folder per migration (`drizzle/<timestamp>_<name>/migration.sql` plus a snapshot), with no `meta/_journal.json`.
- Upgrade both packages together and re-read https://orm.drizzle.team/llms.txt before changing either.

## Seeding

- `npm run db:seed` runs `lib/seed-demo.ts` under `tsx --conditions=react-server`, so `server-only` resolves to its no-op entry like in Next's server build.
- It works on whatever `DATABASE_URL` names and is rerunnable: the demo user is kept, its todos are replaced.
- Scripts that use top-level await are `.mts`: the root package isn't `"type": "module"`, so tsx compiles `.ts` as CommonJS.

## Temp databases

- Vitest: `lib/test-support.ts` (`setUpTestDatabase`) stubs `DATABASE_URL` to a temp file, migrates it, adds Better Auth's test helpers, and deletes it afterwards; modules that read the env are imported dynamically after it.
- E2E: `playwright.config.mts` points `DATABASE_URL` at a fresh temp file and runs `drizzle-kit migrate` before `next dev`.
- `drizzle.config.ts` and `scripts/db-reset.mjs` load `.env` with `process.loadEnvFile`, which, like Next.js, never overrides a variable that is already set.

## Gotchas

- The migrator scans `drizzle/` and throws if the folder is missing; `drizzle/.gitkeep` keeps it in git even without migrations.
- The docs show `migrate(db)`, but the installed `drizzle-orm/libsql/migrator` requires `{ migrationsFolder }`; trust the `.d.ts`.
- `server-only` throws outside Next's server build, so `vitest.config.mts` aliases it to the package's `empty.js`.
- Database tests need `// @vitest-environment node` on their first line; the default jsdom environment is for components.
- `drizzle/` is generated: Biome ignores it, and migrations are never edited by hand once committed.
- `npm run db:reset` refuses non-`file:` URLs and also deletes the `-wal`, `-shm` and `-journal` side files.
