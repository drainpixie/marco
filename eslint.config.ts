import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "eslint/config";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig([
  includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),

  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,

  prettier,
]);
