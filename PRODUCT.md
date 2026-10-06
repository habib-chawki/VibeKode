# Product

<!-- impeccable:product-schema 1 -->

Facts marked *(inferred)* come from the code and `tech-docs/`, not from an interview; everything else is from the owner's brief.

## Platform

web

## Users

- Busy people with a cat and too many errands, on desktop and on their phone.
- Their job: get errands out of their head and onto a list, check them off, and ask what's open, due or next.
- Secondary audience: AI agents working for one of those people, through the `todo-cat` CLI and, later, an MCP server. They need predictable output and no prompts, not personality *(inferred: `tech-docs/cli.md`)*.

## Product Purpose

- A personal to-do list kept by Lissie, a cat with attitude: add, check off, reopen and delete todos, with an optional due date.
- The user can work the list directly or ask Lissie in chat; she reads, adds and checks off todos with tools, and both stay in one list.
- Success: the list stays current with little effort, and the user would rather tell Lissie than open a generic todo app.

## Positioning

- The list has a keeper with a character. Lissie is dry, superior and secretly caring: she comments on every add and every done, and lets a sliver of approval through when things get done.
- She only deals with the list; anything else gets one line of a cat's excuse and a steer back *(inferred: `LISSIE_INSTRUCTIONS` in `lib/lissie.ts`)*.
- The same list is reachable by people (web, chat) and by their agents (CLI, MCP), through one todo service.

## Operating Context

- Short sessions between other things: a thought becomes a todo, an errand gets ticked off, a question gets asked ("anything overdue?").
- One signed-in user, one list, one ongoing conversation with Lissie that survives restarts *(inferred: `tech-docs/agent.md`)*.
- Agents log in with a device code that the human approves in the browser on `/device` *(inferred: `tech-docs/cli.md`)*.

## Capabilities and Constraints

- Built: email and password sign-in; the web list and Lissie's chat on `/`; the REST API `/api/todos`; the `todo-cat` CLI with device login; Lissie's tools `listTodos`, `addTodo`, `setTodoDone` *(inferred: `tech-docs/architecture.md`)*.
- Planned, not built yet: the MCP server, over stdio inside the CLI and over HTTP inside the app *(inferred: `tech-docs/architecture.md`)*.
- Lissie cannot delete todos; deleting is the user's, behind a confirmation in the web list and `--yes` in the CLI *(inferred)*.
- A todo is a title, an optional due date (a date without time), done or open, and when it was created and completed; no pagination, sharing, priorities, tags or soft delete *(inferred)*.
- Every todo belongs to one user; another user's todo is "not found", never "forbidden" *(inferred)*.
- Terminology: "todo" and "the list"; Lissie is "she", the user is "the human" in her voice *(inferred)*.

## Brand Commitments

- Name: `todo-cat`, written `todo·cat` as the wordmark; the keeper is Lissie *(inferred: `app/page.tsx`)*.
- Lissie's voice: dry, superior, unimpressed, short sentences, rarely an exclamation mark; secretly cares; speaks as a cat (naps, sunbeams, the food bowl, knocking things off tables), never as an AI or assistant.
- Her voice is for her remarks, chat replies and empty states; labels and buttons stay plain *(inferred: `tech-docs/ui.md`)*.
- The current visual direction, "Off the Table", is documented in `tech-docs/ui.md`.

## Evidence on Hand

- Demo account and data: `demo@todo-cat.dev` with a dozen cat-household todos, from `npm run db:seed` (`lib/seed-demo.ts`).
- No users, testimonials, metrics, press, pricing or deployment claims exist; don't invent any.
- No illustrations, photos or logo files of Lissie exist; `public/` holds only create-next-app placeholders.

## Product Principles

1. The list is the product; Lissie is how it feels. Her character never costs the user a step or hides a todo.
2. One list, many doors: web, chat, CLI and MCP change the same todos through the same service, and each sees the others' changes.
3. Plain where the user acts, Lissie where she speaks.
4. Built for agents too: predictable, scriptable, never prompting, nothing destructive without explicit consent.
5. Private by default: a user's todos and conversation are theirs alone.

## Accessibility & Inclusion

- Works on phone and desktop widths; follows the OS light or dark setting; respects reduced motion *(inferred: `tech-docs/ui.md`, `app/globals.css`)*.
- No conformance level has been set yet.
