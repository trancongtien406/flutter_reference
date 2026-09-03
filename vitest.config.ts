import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/analysis/impact.ts",
        "src/cache/referenceCache.ts",
        "src/core/location.ts",
        "src/core/queryQueue.ts"
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
    }
  },
  resolve: { alias: { vscode: new URL("./test/vscode.ts", import.meta.url).pathname } }
});
