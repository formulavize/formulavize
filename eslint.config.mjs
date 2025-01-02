import globals from "globals";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import eslintPluginVue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/", "**/shims-vue.d.ts"],
  },
  {
    files: ["*.ts", "**/*.ts", "*.vue", "**/*.vue"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...eslintPluginVue.configs["flat/recommended"],
      ...vueTsEslintConfig(),
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
);
