import { defineConfig } from "vitest/config";

// Headless tests for the daemon supervisor — node environment, no Electron runtime.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/daemon/**/*.test.ts"],
  },
});
