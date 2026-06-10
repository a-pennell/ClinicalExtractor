import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ADR-001 acceptance criterion 3: application code must not import the frozen
 * TS clinical-inference modules. (Lives under server/ as .mjs so it runs in a
 * Node context and stays out of the browser app's tsconfig build.)
 *
 * Two tiers, both also enforced by eslint no-restricted-imports:
 *  - PURE inference (negationRules, dedupeEntities): importable ONLY by the
 *    frozen aggregator extractClinicalEntities.
 *  - The frozen aggregator: importable only by the documented component
 *    fallback and the frozen eval/demo surface.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(here, "..", "src");

const PURE_INFERENCE = ["negationRules", "dedupeEntities"];
const PURE_INFERENCE_ALLOWED = new Set(["extractClinicalEntities.ts"]);

const FROZEN_AGGREGATOR = ["extractClinicalEntities"];
const AGGREGATOR_ALLOWED = new Set([
  "ClinicalEntityExtractorPrototype.tsx", // documented ADR-001 fallback
  "evaluationFixtures.ts" // frozen-demo surface
]);

function collectSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [full];
  });
}

function importersOf(modules, allowed) {
  const offenders = [];
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const base = file.split("/").pop() ?? file;
    if (allowed.has(base)) continue;
    if (modules.some((mod) => base.startsWith(`${mod}.`))) continue;
    const source = readFileSync(file, "utf8");
    for (const mod of modules) {
      if (new RegExp(`from ["'][^"']*/${mod}["']`).test(source)) offenders.push(`${base} -> ${mod}`);
    }
  }
  return offenders;
}

describe("frozen module isolation (ADR-001)", () => {
  it("pure inference modules are imported only by the frozen aggregator", () => {
    expect(importersOf(PURE_INFERENCE, PURE_INFERENCE_ALLOWED)).toEqual([]);
  });

  it("the frozen aggregator is imported only by the documented fallback and frozen-demo surface", () => {
    expect(importersOf(FROZEN_AGGREGATOR, AGGREGATOR_ALLOWED)).toEqual([]);
  });
});
