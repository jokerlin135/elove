import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@elove/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@": resolve(__dirname, "./src"),
    },
  },
});
