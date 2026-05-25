import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/role-team/**/*.test.ts"],
    setupFiles: ["tests/role-team/setup.ts"],
    globalSetup: ["tests/role-team/globalSetup.ts"],
    globalTeardown: ["tests/role-team/globalTeardown.ts"],
    reporters: ["verbose"],
    testTimeout: 15_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
