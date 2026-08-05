import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["pkg/", "dist/", "target/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["test/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", console: "readonly", Buffer: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", Buffer: "readonly" },
    },
  },
);
