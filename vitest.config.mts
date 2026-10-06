import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the "@/*" alias from tsconfig.json natively.
    tsconfigPaths: true,
    alias: {
      // server-only throws outside Next's react-server build; use its no-op entry.
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    env: { COPILOTKIT_TELEMETRY_DISABLED: "true" },
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "e2e/**", ".claude/**", ".next*/**"],
  },
});
