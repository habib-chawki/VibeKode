# REST API

The REST adapter over the todo service (see `architecture.md`), for non-browser clients such as the CLI (`cli.md`). Handlers live in `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts` and `app/api/me/route.ts`; the shared plumbing (user, parsing, error mapping) is `lib/rest.ts`.

## Endpoints

Schemas are from `@todo-cat/contract`; every error body is `ErrorBodySchema` (`{ error: { code, message } }`).

- `GET /api/todos?status=open|done|all&q=text` → 200 `TodoListSchema` (query: `TodoListFilterSchema`, default `open`); 400, 401.
- `POST /api/todos` body `NewTodoSchema` → 201 `TodoSchema` with `Location: /api/todos/<id>`; 400, 401.
- `GET /api/todos/:id` → 200 `TodoSchema`; 401, 404.
- `PATCH /api/todos/:id` body `TodoUpdateSchema` (`dueDate: null` clears it) → 200 `TodoSchema`; 400, 401, 404.
- `DELETE /api/todos/:id` → 204 with an empty body; 401, 404.
- `GET /api/me` → 200 `CurrentUserSchema` (who the token belongs to); 401.

Status codes: 401 `unauthorized` (no or invalid token), 404 `todo-not-found`, 400 `validation-failed` (bad JSON, schema violation, unknown `status`).

## Getting a bearer token with curl

Sign in; the bearer plugin returns the token in the `set-auth-token` response header (the seeded demo user shown, see `npm run db:seed`):

```bash
TOKEN=$(curl -s -D - -o /dev/null -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"demo@todo-cat.dev","password":"cat-person-2026"}' \
  | awk 'tolower($1)=="set-auth-token:"{print $2}' | tr -d '\r')

curl -s http://localhost:3000/api/todos -H "authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/api/todos -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"title":"Brush Lissie","dueDate":"2026-10-09"}'
curl -s -X PATCH http://localhost:3000/api/todos/<id> -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"done":true}'
```

- `set-auth-token` is the signed session token (`<token>.<signature>`); the raw `token` field of the sign-in JSON body works too, because the plugin signs unsigned tokens itself (`requireSignature` is off).
- A session cookie works as well, so the browser app can call the same endpoints.

## Decisions

- The user is resolved before the input is parsed: bad input without a token is 401, not 400.
- Another user's id, an unknown id and a malformed id all give the same 404 body; ids are never validated as UUIDs, so their format reveals nothing.
- Handlers stay thin: parse with a contract schema, `withUser`, call the service, return; error mapping lives only in `lib/rest.ts`.
- Unknown JSON fields are dropped by the contract schemas rather than rejected.

## Testing

- `app/api/todos/route.test.ts` calls the route handlers directly on a temp database (`lib/test-support.ts`), with a real token from the `/api/auth` handler.
- It holds two 401 tests per endpoint (no token, invalid token), the full flow, the 404 cases, and the 400 cases.
- Route context in tests is `{ params: Promise.resolve({ id }) }`, matching Next 16's promised params.
