import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".agents/**", "dist/**", "node_modules/**", "playwright-report/**", "test-results/**", "work/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Scaffold ports intentionally consume dependencies with `void` until their plan adds logic.
      "@typescript-eslint/no-meaningless-void-operator": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    files: ["src/building/domain/**/*.ts", "src/challenge/domain/**/*.ts", "src/kernel/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["three", "three/*", "@dimforge/rapier3d-compat", "@dimforge/rapier3d-compat/*"], "message": "Domain and kernel code must remain framework-independent." },
          { "group": ["../../adapters/*", "../../../adapters/*", "../../app/*", "../../../app/*"], "message": "Domain and kernel code cannot import delivery or infrastructure adapters." }
        ]
      }]
    }
  }
);
