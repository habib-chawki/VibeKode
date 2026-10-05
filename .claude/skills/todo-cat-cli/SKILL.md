---
name: todo-cat-cli
description: Manage a person's to-do list (todo-cat, kept by Lissie the cat) with the `todo-cat` CLI. Use this whenever the user talks about their list, todos, tasks or reminders, even without naming todo-cat — "remind me to…", "put X on my list", "tick off…", "what's still open?", "anything overdue?", "what did I add last week?" — and whenever you'd otherwise reach for the todo-cat REST API or database directly.
---

# Managing a to-do list with todo-cat

The `todo-cat` CLI is the user's door to their list: it acts as the signed-in user and nobody else. Run it as `npx todo-cat` from the todo-cat repo (or `todo-cat` if it's on the PATH). `npx todo-cat --help` is the source of truth for commands, options and exit codes; when this skill and the help disagree, believe the help and mention the mismatch.

This skill is about how to use it well: what to check first, in which order to do things, and where the sharp edges are. `--json` works before or after the command (`todo-cat --json list` = `todo-cat list --json`).

## 1. Check the login first, and never work around it

Start every session with:

```bash
npx todo-cat --json whoami
```

- Exit 0: you're acting as that user. Use their name in your replies if it helps.
- Exit 3 (not signed in, or the session expired or was revoked): stop and tell the user to run `npx todo-cat login` themselves and approve the code in their browser. The login is the user's consent to let you touch their list, so don't approve codes, read or edit `~/.config/todo-cat/credentials.json`, sign in with a password, create accounts, or call the REST API or the database directly instead. Any of those would bypass that consent.
- Exit 6 (server unreachable, or it answered off-contract): usually the app isn't running at `TODO_CAT_URL` (default `http://localhost:3000`); in the repo it's started with `npm run dev`. If the message says the response didn't match the contract, the server is up but misbehaving. Either way, tell the user; don't start servers or change `TODO_CAT_URL` unless they ask.
- Exit 7 from `login` (denied or the code expired) only happens when the user runs `login`; they can simply run it again.

## 2. Find todos by title before acting on an id

Commands like `done`, `edit`, `reopen` and `delete` take an id, which is a UUID you can't guess or remember from a previous conversation. Look it up first:

```bash
npx todo-cat --json list --status all --search "litter"
```

- Search for a distinctive word from what the user said, not the whole sentence; it's a case-insensitive substring match on the title (reliable for ASCII letters).
- `list` shows only **open** todos unless you pass `--status done` or `--status all`. Use `all` when looking something up; a todo the user wants to reopen is done, so it won't show up otherwise.
- Exactly one match: act on it. Several: pick by title if one clearly fits, otherwise ask. None: try a shorter or different word before telling the user it isn't on the list.
- Exit 4 (`todo-not-found`) on an id means it's gone or belongs to someone else; look it up again rather than retrying.
- Ids from an earlier `list` can go stale if the list changed in the meantime (the user, or another assistant, may be editing it too). Look up again right before changing something, and use `show <id>` to check a single todo.

## 3. Answer questions with `--json` and jq

For anything beyond "show my list", fetch JSON once and compute the answer, instead of eyeballing text output:

```bash
npx todo-cat --json list --status all > /tmp/todos.json   # one request, then query it
```

Each todo has `id`, `title`, `dueDate` (`yyyy-mm-dd` or `null`), `done`, `createdAt` and `completedAt` (ISO timestamps in UTC, `completedAt` is `null` while open). The list comes back in display order (open first, then by due date), not by creation time, so sort when time order matters.

Pick the right date for the question; this is where answers usually go wrong:

- **Overdue, due soon, due this week** → `dueDate`, open todos only.
- **What they *put on* or added to the list** ("what did I add last week?") → `createdAt`.
- **What they *finished* or ticked off** ("what did I get done yesterday?") → `completedAt`.

```bash
today=$(date +%F)
# overdue: open, with a due date before today; and what's due today, which people asking about overdue usually want to hear too
jq -r --arg today "$today" '.[] | select(.done | not) | select(.dueDate != null and .dueDate < $today) | "\(.dueDate)  \(.title)"' /tmp/todos.json
jq -r --arg today "$today" '.[] | select(.done | not) | select(.dueDate == $today) | .title' /tmp/todos.json

# last calendar week, Monday to Sunday. Computed from today's weekday because GNU
# `date -d "last monday"` means a week ago when today is a Monday, but this week's Monday otherwise.
this_monday=$(date -d "$today -$(( $(date +%u) - 1 )) days" +%F)
last_monday=$(date -d "$this_monday -7 days" +%F)
# added in that week, by local day, oldest first, with status and due date for the reply
jq -r --arg from "$last_monday" --arg to "$this_monday" '
  def localday: sub("\\.[0-9]+Z$"; "Z") | fromdate | strflocaltime("%F");
  [.[] | select((.createdAt | localday) >= $from and (.createdAt | localday) < $to)]
  | sort_by(.createdAt)[]
  | "\(.createdAt | localday)  \(if .done then "done" else "open" end)  \(.title)\(if .dueDate then "  (due \(.dueDate))" else "" end)"' /tmp/todos.json
```

- Compute date ranges with `date` rather than in your head, and say which range you used ("last week, Mon 28 Sep to Sun 4 Oct"), since "last week" can also mean the past seven days.
- Due dates are calendar dates without a time; compare them as `yyyy-mm-dd` strings against the local date (`date +%F`).
- `createdAt` and `completedAt` are UTC instants; convert them to the local day with the `localday` function above, otherwise todos added late in the evening land on the wrong day.
- Undated todos have `dueDate: null`; they're never overdue.

## 4. Changing the list

- **Add**: `npx todo-cat add "<the user's words>" --due <yyyy-mm-dd>`. Keep the user's wording for the title, and search first (section 2) so you don't add something that's already on the list.
- **Relative dates**: turn them into `yyyy-mm-dd` with `date`. For "next Friday", use the coming Friday (`date -d "next friday" +%F`) and say so, offering the Friday after (`date -d "friday next week" +%F`) in the same reply; the earlier date is the safer reading for a reminder. Ask before adding only when a wrong date would really hurt (a bill, a flight). Always tell the user the date you picked.
- **Tick off / finished / done**: `done <id>`. **Not done after all**: `reopen <id>`. **Rename or change the date**: `edit <id> --title … / --due … / --no-due`.
- **Delete only when the user asks to delete or remove something.** "Tick off", "I did it" and "finished" mean `done`, which keeps the history; deleting is permanent. `delete` refuses without `--yes` (exit 2); add `--yes` only when the request is clearly a deletion, and name the todo you deleted in your reply.
- One request can contain several changes ("tick off X and remind me to Y"). Do each, and report each result.

## 5. Errors and exit codes

With `--json`, errors arrive on stderr as `{"error":{"code":…,"message":…}}`; branch on the exit code or `code`, and relay the message when it helps the user.

- 1 unexpected error: report the message to the user; don't retry in a loop.
- 2 usage error: fix the command (see `--help`); don't retry it unchanged.
- 3 sign-in needed, 6 server unreachable or off-contract, 7 login denied or expired: see section 1.
- 4 not found: look the todo up again (section 2).
- 5 `validation-failed`: the input was invalid, checked locally and by the server: an empty title, a date that isn't a real `yyyy-mm-dd`, or an `edit` with nothing to change. Fix the input, or ask the user if you can't tell what they meant.

## 6. Reporting back

Tell the user what changed or what you found, in their words: titles and dates, not ids or raw JSON. For questions, give the answer and the rule you used ("overdue = open with a due date before today, 5 Oct"). If nothing matched, say so plainly and suggest what might help.
