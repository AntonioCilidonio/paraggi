import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
      "**/coverage/**",
      "**/dist/**",
      "outputs/**"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __DEV__: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);
