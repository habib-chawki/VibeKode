import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

// Ask the OS for a free port once, in the runner; workers re-load this file
// and inherit E2E_PORT from the runner's environment.
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("no port assigned"));
      });
    });
  });
}

process.env.E2E_PORT ??= String(await freePort());
const port = Number(process.env.E2E_PORT);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${port}`,
    url: baseURL,
    // Always our own server: never test against a developer's `npm run dev`.
    reuseExistingServer: false,
    env: { NEXT_DIST_DIR: process.env.E2E_DIST_DIR ?? ".next-e2e" },
  },
});
