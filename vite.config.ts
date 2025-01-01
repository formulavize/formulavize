import { defineConfig as testConfig } from "vitest/config";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";

const config = defineConfig({
  plugins: [Vue()],
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
