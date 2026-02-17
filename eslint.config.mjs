import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "src-tauri/",
      "src/components/ui/",
    ],
  }
);
