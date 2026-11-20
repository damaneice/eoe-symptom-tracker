import js from "@eslint/js";
import solid from "eslint-plugin-solid/configs/typescript";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", ".wrangler", "worker-configuration.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ...solid,
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["*.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
]);
