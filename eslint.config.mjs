import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["**/.output/**", "**/.next/**", "**/dist/**", "**/.wxt/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      // ponytail: brief's literal ruleset flags Playwright's idiomatic empty-destructure
      // fixture param (`async ({}, use) => {...}` in tests/system/fixtures.ts, Task 14,
      // closed/reviewed — not touching it). This is ESLint's documented knob for exactly
      // that pattern, not a rule we're disabling outright.
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
    },
  },
);
