import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * ADR-001 enforcement: frozen TS clinical-inference modules must not be
 * imported by application code. The clinician workbench component carries a
 * documented exception (legacy fallback until engine lexicon parity); the
 * eval/lab demo panels are a frozen-demo surface and keep their existing
 * imports. See docs/ADR-001-pipeline-consolidation.md.
 */

const FROZEN_INFERENCE_PATTERNS = [
  { group: ["**/clinical-extraction/negationRules"], message: "Frozen (ADR-001): assertion is resolved by clinical_nlp. Use the engine via extractionClient." },
  { group: ["**/clinical-extraction/dedupeEntities"], message: "Frozen (ADR-001): entity rollup lives in clinical_nlp/rollup.py. Use the engine via extractionClient." },
  { group: ["**/clinical-extraction/extractClinicalEntities"], message: "Frozen (ADR-001): use lib/clinical-extraction/extractionClient (server engine)." }
];

export default tseslint.config(
  { ignores: [".venv/**", "dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": ["error", { patterns: FROZEN_INFERENCE_PATTERNS }]
    }
  },
  {
    files: ["server/**/*.mjs", "scripts/**/*.mjs", "*.mjs"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    // Frozen modules and the documented exceptions may import each other.
    files: [
      "src/lib/clinical-extraction/extractClinicalEntities.ts",
      "src/lib/clinical-extraction/evaluationFixtures.ts",
      "src/lib/clinical-extraction/pipelineLab.ts",
      "src/components/clinical-entity-extractor/ClinicalEntityExtractorPrototype.tsx",
      "src/components/clinical-entity-extractor/EvalLabPanel.tsx"
    ],
    rules: { "no-restricted-imports": "off" }
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.config.{ts,mjs}"],
    rules: { "no-restricted-imports": "off", "@typescript-eslint/no-explicit-any": "off" }
  }
);
