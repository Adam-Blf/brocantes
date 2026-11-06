import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Les tests de bout en bout sont joues par Playwright, pas ici.
    include: ["tests/unite/**/*.test.ts"],
    environment: "node",
  },
});
