import { rmSync } from "node:fs";

// Deletes the throwaway database folder playwright.config.mts created for this run.
export default function globalTeardown() {
  const dir = process.env.E2E_TEMP_DIR;
  if (dir) rmSync(dir, { recursive: true, force: true });
}
