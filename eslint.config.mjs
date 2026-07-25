import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      "assets/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // CLAUDE.md §4.8 — no `any` without an annotated reason.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // CLAUDE.md §4.4 / TECHNICAL_ARCHITECTURE §3 — sim core purity:
    // deterministic, portable, presentation-free.
    files: ["src/sim/**/*.ts", "src/shared/**/*.ts", "src/content/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["three", "three/*"], message: "sim/shared/content must not import three" },
            { group: ["react", "react-*"], message: "sim/shared/content must not import react" },
            { group: ["next", "next/*"], message: "sim/shared/content must not import next" },
            { group: ["*render*", "@/render/*"], message: "sim may not import render" },
            { group: ["*ui*", "@/ui/*"], message: "sim may not import ui" },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "sim core is DOM-free" },
        { name: "document", message: "sim core is DOM-free" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng (shared/rng)." },
        { object: "Date", property: "now", message: "Sim time is injected, never wall-clock." },
      ],
    },
  },
];

export default config;
