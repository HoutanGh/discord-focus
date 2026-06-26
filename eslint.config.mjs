import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["artifacts/**", "dist/**", "node_modules/**", "web-ext-artifacts/**"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tools/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        browser: "readonly",
        chrome: "readonly",
        module: "readonly",
        require: "readonly"
      }
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node
    }
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node
    }
  }
];
