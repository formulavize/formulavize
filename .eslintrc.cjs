module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "plugin:prettier/recommended",
    "eslint:recommended",
    "prettier",
    "@vue/typescript",
  ],
  plugins: ["vue"],
};
