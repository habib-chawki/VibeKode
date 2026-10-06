# UI

## Direction: "Off the Table"

Lissie's desk, where every todo is one paw-swipe from the floor. Chosen with the `frontend-design` skill; keep new UI inside it.

- Color: fog paper and a near-white desk (`paper`, `surface`), slate fur and ink (`fur`, `ink`); her amber eyes (`eye`) only for focus and checked boxes, her rose nose (`nose`) only for overdue, delete and errors.
- Lines in her eye color (focus rings, link underlines) use `eye-line`: bright amber is under 2:1 on fog paper, so light mode gets a deep amber; dark mode uses `eye` itself.
- The wordmark's dot (`components/wordmark.tsx`) is the one decorative use of `eye`.
- Type: Bricolage Grotesque (`font-display`) only for headings, the wordmark and Lissie's one-line remarks; Geist (`font-sans`) for everything else.
- Layout: the chat is the stage, the list a 16rem desk column to its right (stacked below on phones), the page viewport-high so only the conversation and the list scroll.
- Signature detail, the one loud thing: deleting a todo knocks it off the table (`.knocked-off`, a 300 ms tip-and-slide; a plain fade with reduced motion). Don't add a second one.
- Copy: plain labels and active buttons; Lissie's voice only in her remarks and the empty state ("Nothing open. Suspicious.").

## Where things live

- Product context for design work (users, Lissie's voice, principles): `PRODUCT.md` at the repo root, read by the `impeccable` skill.
- Tokens: `app/globals.css` (`:root` for light, the `prefers-color-scheme: dark` block for dark), exposed to Tailwind via `@theme inline` (`bg-paper`, `text-fur`, `accent-eye`, `text-nose`…).
- Each theme declares `color-scheme`, so native checkboxes, date pickers and scrollbars follow it.
- Shared pieces: `components/ui/` (`Button` with `size="md" | "sm"`, `TextField`, `FormError`, `TextLink`, `ProgressBar`: ink on a fur track) and `components/wordmark.tsx`; `components/lissie-says.tsx` is the auth and device pages' layout: the wordmark, then her remark as the h1 next to the form, with no label above it.
- Home: `app/page.tsx` (header with the `todo·cat` wordmark), `app/lissie-chat.tsx` (provider, chat, layout), `app/todo-list.tsx` (the list), `app/tool-call-line.tsx` (tool-call lines).

## The list

- `app/todo-list.tsx` is a client of the REST adapter (`/api/todos`), like the CLI: add with an optional due date, check off and reopen (optimistic, then refetched), delete after an inline "Delete it for good?" confirmation.
- It refetches on every Lissie tool result except the read-only ones (`READ_ONLY_TOOLS`) and at the end of each run, so her changes and the user's stay in one list.
- Due dates read as people say them (`app/due-label.ts`: "Due today", "Due Fri 9 Oct", "Overdue by 2 days") inside a `<time>`, compared as calendar days so no time zone shifts them.
- The date field shows only once a title is typed; revealing it on focus instead would hide it on blur and shift the list under the pointer mid-click.
- Keyboard and screen readers: the delete confirmation takes focus (Keep), Esc keeps, focus moves to the next row after a delete; adds, check-offs and deletes are announced in a polite live region.
- `e2e/list.spec.ts` covers add, check off, reopen, and delete with its confirmation.

## CopilotKit styling gotchas

- Its dark styles key on a `.dark` class, the app follows the OS: `app/lissie-chat.tsx` sets `.dark` on the chat wrapper from `prefers-color-scheme`, and `app/globals.css` maps its tokens onto ours.
- `app/globals.css` widens its `cpk:max-w-3xl` conversation wrapper to 56rem; that's a vendor class name, so recheck after an upgrade.
- Its input keeps a three-line minimum height, which costs space on phones; the greeting is hidden below `sm` to compensate.
- Tests don't see CSS: after changing colors, the chat or the layout, screenshot the running app at 1440 and 390 px in light and dark.
