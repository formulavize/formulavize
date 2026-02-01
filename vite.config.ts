import { defineConfig } from "vitest/config";
import path from "path";
import Vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
