import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      // Note: AST-aware remapping is the default in Vitest 4 (the v3
      // `experimentalAstAwareRemapping` flag has been removed), so no
      // explicit opt-in is needed here.
      reporter: ["text", "html"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
      exclude: [
        // Test files themselves are not production code.
        "src/**/*.test.{ts,tsx}",
        // Test harness, fixtures, and setup utilities.
        "src/test/**",
        // Build output.
        "dist/**",
        // Build/dev scripts; exercised manually or via CI, not unit tests.
        "scripts/**",
        /*
         * Generated/vendored shadcn-style UI primitives. These are thin
         * wrappers over Radix and other libraries with little branching
         * logic of our own; covered indirectly through component-level
         * and E2E tests rather than unit tests against the primitives.
         */
        "src/components/ui/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
