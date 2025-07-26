import { defineConfig as testConfig } from "vitest/config";
import { defineConfig } from "vite";
import path from "path";
import Vue from "@vitejs/plugin-vue";

const config = defineConfig({
  plugins: [Vue()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, "./src"),
    },
  },
});

const testCfg = testConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});

export default {
  ...config,
  ...testCfg,
};
