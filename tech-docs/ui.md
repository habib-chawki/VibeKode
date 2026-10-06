# UI

## Direction: "Off the Table"

Lissie's desk, where every todo is one paw-swipe from the floor. Chosen with the `frontend-design` skill; keep new UI inside it.

- Color: fog paper and a near-white desk (`paper`, `surface`), slate fur and ink (`fur`, `ink`); her amber eyes (`eye`) only for focus and checked boxes, her rose nose (`nose`) only for overdue and delete.
- Type: Bricolage Grotesque (`font-display`) only for headings, the wordmark and Lissie's one-line remarks; Geist (`font-sans`) for everything else.
- Layout: the chat is the stage, the list a 16rem desk column to its right (stacked below on phones), the page viewport-high so only the conversation and the list scroll.
- Signature detail, the one loud thing: deleting a todo knocks it off the table (`.knocked-off`, a 300 ms tip-and-slide; a plain fade with reduced motion). Don't add a second one.
- Copy: plain labels and active buttons; Lissie's voice only in her remarks and the empty state ("Nothing open. Suspicious.").

## Where things live

- Tokens: `app/globals.css` (`:root` for light, the `prefers-color-scheme: dark` block for dark), exposed to Tailwind via `@theme inline` (`bg-paper`, `text-fur`, `accent-eye`, `text-nose`…).
- Shared pieces: `components/ui/` (`Button`, `TextField`, `FormError`, `TextLink`); `components/lissie-says.tsx` is the auth and device pages' layout.
- Home: `app/page.tsx` (header with the `todo·cat` wordmark), `app/lissie-chat.tsx` (provider, chat, layout), `app/todo-list.tsx` (the list), `app/tool-call-line.tsx` (tool-call lines).

## The list

- `app/todo-list.tsx` is a client of the REST adapter (`/api/todos`), like the CLI: add with an optional due date, check off and reopen (optimistic, then refetched), delete after an inline "Delete it for good?" confirmation.
- It refetches on every non-list Lissie tool result and at the end of each run, so her changes and the user's stay in one list.
- `e2e/list.spec.ts` covers add, check off, reopen, and delete with its confirmation.

## CopilotKit styling gotchas

- Its dark styles key on a `.dark` class, the app follows the OS: `app/lissie-chat.tsx` sets `.dark` on the chat wrapper from `prefers-color-scheme`, and `app/globals.css` maps its tokens onto ours.
- `app/globals.css` widens its `cpk:max-w-3xl` conversation wrapper to 56rem; that's a vendor class name, so recheck after an upgrade.
- Its input keeps a three-line minimum height, which costs space on phones; the greeting is hidden below `sm` to compensate.
- Tests don't see CSS: after changing colors, the chat or the layout, screenshot the running app at 1440 and 390 px in light and dark.
