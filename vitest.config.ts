import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    // .claude/worktrees holds agent worktrees — full copies of this repo whose
    // tests would otherwise be collected and run alongside our own.
    exclude: ["**/node_modules/**", ".next", "public", ".claude/**"],
  },
});
