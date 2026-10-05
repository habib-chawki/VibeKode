#!/usr/bin/env node
// Committed shim: npm links a bin only if its file exists at install time, and the real
// code is built into dist/ (npm run build -w cli).
import { existsSync } from "node:fs";

const entry = new URL("../dist/todo-cat.js", import.meta.url);
if (!existsSync(entry)) {
  process.stderr.write(
    "todo-cat isn't built yet: run `npm run build -w cli` in the repo root.\n",
  );
  process.exit(1);
}
await import(entry.href);
