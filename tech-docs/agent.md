# Lissie, the agent

## Approach

- Lissie is a Mastra agent (`lib/lissie.ts`): her persona is the system prompt `LISSIE_INSTRUCTIONS`, and it is product, not config: it decides how the app feels.
- Model via OpenRouter through Mastra's model router: `OPENROUTER_MODEL` (default `z-ai/glm-5.3-flash`), key `OPENROUTER_API_KEY`, read only on the server.
- Memory is Mastra's `Memory` on a `LibSQLStore` that reuses `lib/db.ts`'s client: Mastra's own `mastra_*` tables in `data/app.db`, created on first use.
- One thread per user: `lissieThreadId(userId)` = `lissie-<userId>`, resource = the user id; conversations survive restarts.
- The browser talks to her through CopilotKit (`app/lissie-chat.tsx`) over AG-UI; `app/api/copilotkit/[[...slug]]/route.ts` hands every request to `handleCopilotRequest` in `lib/copilot-runtime.ts`.
- Versions are pinned exactly (`@mastra/*`, `@ag-ui/*`, `@copilotkit/*`): this three-package handshake changes monthly; read the `mastra` and `copilotkit` skills and the installed sources before changing any of them.

## Memory scoping is authorization

- The user comes from `getUserId` (cookie or bearer) before the runtime sees the request: no user, 401.
- Each request builds its own `MastraAgent` with `resourceId` and the `mastra__resourceId` request-context key set to that user, so the client can't choose whose memory is read; Mastra also refuses a thread owned by another resource.
- The CopilotKit runtime serves ~25 routes (thread lists, any thread's messages and events, clear all, debug events, transcription…); the browser needs four.
- `onBeforeHandler` in `lib/copilot-runtime.ts` is deny by default: only `info`, and `run`/`connect`/`suggest`/`stop` for agent `lissie` on the user's own thread pass; everything else is 404, the same as "doesn't exist".
- `lib/copilot-runtime.test.ts` checks every route: 401 without a session or with a bad token, 404 for everything not allowed, another user's thread on every thread route, and memory isolation.

## Headers never reach the model

- By default the runtime copies `authorization` and `x-*` headers onto the agent, `@ag-ui/mastra` passes them to the model call, and the OpenRouter provider lets them replace its own key: a CLI user's session token would go to OpenRouter.
- `forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] }` forwards nothing, and `authorization` and `cookie` are stripped before the runtime runs; a test checks what the (fake) model receives.
- Mastra itself still sends `x-thread-id` and `x-resource-id` to the provider, so OpenRouter sees our opaque user and thread ids.

## History after a restart

- The runtime's default runner keeps thread events in process memory only; after a restart `connect` would replay nothing although Mastra still remembers.
- `MemoryBackedRunner` falls back to one `MESSAGES_SNAPSHOT` built from Mastra memory (`loadLissieHistory`), keeping Mastra's message ids so `@ag-ui/mastra` recognises re-sent history and doesn't store it twice.

## Testing

- Unit and integration tests use AI SDK's `MockLanguageModelV3` via `setLissieModelForTests`: no key, no cost, deterministic.
- `e2e/chat.spec.ts` loads the chat and calls the runtime through the real Next.js server.
- `npm run test:chat` (`e2e-llm/`, `playwright.llm.config.mts`) calls the real model; it's slow, non-deterministic and paid, so it stays out of the QA script and CI, and skips without a key.

## Gotchas

- `new Request(request, …)` throws on Next's `NextRequest` in route handlers (`Cannot read private member #state`) but works in Vitest, so the stripped request is built from its parts and only the e2e test catches a regression.
- CopilotKit's dark styles key on a `.dark` class while the app follows the OS: `app/lissie-chat.tsx` sets `.dark` on the chat wrapper from `prefers-color-scheme`, and `app/globals.css` maps CopilotKit's tokens onto the app's palette; tests don't see contrast, so check screenshots in both modes after touching either.
- In dev, CopilotKit's inspector bubble says "Failed to load threads": the guard denies `/threads` on purpose.
- With an explicit `threadId`, CopilotChat never shows its welcome screen; two tabs running at once collide ("Thread already running").
- `COPILOTKIT_TELEMETRY_DISABLED=true` (in `.env.example`, and Vitest's env) turns off the runtime's telemetry.
- `@ag-ui/core@0.0.59` copies under `@copilotkit/channels-*` are unused by our code path; every copy we import is 1.0.1 (`npm ls @ag-ui/core`).
