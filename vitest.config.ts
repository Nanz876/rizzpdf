import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // A cold first run - after a reboot, or any change to node_modules - transforms
    // and imports the whole tree before a single test body executes. That import has
    // measured over 45s, longer than Vitest's 5s default, so the slowest fixture
    // (excel-to-pdf reading a workbook) got reported as a timeout failure on a suite
    // that is actually green. Warm runs finish that file in well under a second; this
    // ceiling only ever absorbs the cold start.
    testTimeout: 20000,
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    // .claude/worktrees holds agent worktrees — full copies of this repo whose
    // tests would otherwise be collected and run alongside our own.
    exclude: ["**/node_modules/**", ".next", "public", ".claude/**"],
  },
});
