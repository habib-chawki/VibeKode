# Authentication

## Approach

- Better Auth with email and password only, pinned exactly to 1.7.7 (`better-auth`, `@better-auth/drizzle-adapter`, and the `auth` CLI as a dev dependency).
- `lib/auth.ts` is the server instance on `lib/db.ts`; `app/api/auth/[...all]/route.ts` mounts it; `lib/auth-client.ts` is the browser client the forms use.
- Options live in `lib/auth-options.ts` (plugins, email and password, the database adapter factory) and are shared by the app, the schema CLI and the tests.
- `bearer`: the REST API and the CLI send `Authorization: Bearer <session token>`.
- `deviceAuthorization`: the CLI logs in like `gh auth login`; `validateClient` accepts only `CLI_CLIENT_ID`, and signed-in users approve or deny codes on `/device` (`app/device/`), see `cli.md`.
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` come from the environment; Better Auth reads them itself.

## The one session seam

- `lib/session.ts` is the only code that reads sessions: `getCurrentUser(request | headers)` and `getUserId(request | headers)` return the user (or its id) for a session cookie or a bearer token, else `null`.
- Every adapter uses it: pages, REST, the CopilotKit runtime (`lib/copilot-runtime.ts`), and agent tools and MCP later; nothing else calls `auth.api.getSession`.
- Pages check the session on the server (`app/page.tsx` redirects to `/login`); client-side state is only UX, never the gate.
- `/login` and `/signup` take `?next=` (local paths only, `lib/safe-next.ts`) and send signed-in users there, so `/device` survives the detour through sign-in.
- `/device` follows RFC 8628's approval rules: it shows the client, the account and the code, needs an explicit Approve or Deny, and warns against codes sent by someone else.

## Schema

- The auth tables are generated, never hand-written: `npm run auth:generate` writes `lib/auth-schema.ts`, then `npm run db:generate` turns it into a migration under `drizzle/`.
- `lib/schema.ts` re-exports the auth tables, and `lib/db.ts` registers `authRelations`.
- Regenerate whenever an auth plugin or option that adds fields changes.

## UI

- Shared form pieces live in `components/ui/`; pages compose them instead of repeating class strings.
- Theme tokens (`paper`, `surface`, `fur`, `ink`, `eye`, `danger`) are defined once in `app/globals.css`, with a dark-mode variant.
- `components/lissie-says.tsx` is the auth pages' layout: Lissie's remark as the one loud element, the form beside it.

## Testing

- `lib/auth.test.ts` runs real Better Auth flows in Vitest on a temp database: sign-up, right and wrong password, and `getUserId` for cookie, bearer and neither.
- The test-utils plugin (`testUtils()`) lives only in a test-only instance built from `authOptions` on the same database, never in the production config.
- `e2e/auth.spec.ts` covers the real sign-up, sign-out and sign-in flow in the browser.

## Gotchas

- The Better Auth CLI can't load anything that imports `server-only`, so it runs on `auth.config.mts`, which uses `drizzle.mock()` instead of `lib/db.ts`.
- Use the `relations-v2` adapter (`@better-auth/drizzle-adapter/relations-v2`): the default adapter and the CLI's `--adapter drizzle` flag both emit Drizzle relations v1, which Drizzle v1 no longer has; the configured v2 adapter makes the CLI emit `defineRelationsPart`.
- `npm run auth:generate` runs `biome check --write` on the output, otherwise the generated import order fails lint.
- A wrong password throws an `APIError` with status 401 and code `INVALID_EMAIL_OR_PASSWORD`; the sign-in form maps 401 to its own message.
- Approving a device code takes two calls from the same signed-in session: `GET /api/auth/device?user_code=…` claims the code, then `POST /api/auth/device/approve`; requests with cookies but no `Origin` or `Referer` header get 403 `MISSING_OR_NULL_ORIGIN`.
- Better Auth checks request origins against `BETTER_AUTH_URL`; test servers set it to their own URL (see `testing.md`).
