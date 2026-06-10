import { describe, expect, it } from "vitest";
import { extractClinicalEntities } from "./extractClinicalEntities";
import type { ClinicalEntity, ExtractionOptions } from "./types";

/**
 * AUDIT EDGE-CASE TESTS (docs/pre-review-audit.md).
 *
 * ADR-001 cutover is complete: the authoritative, PASSING acceptance tests for
 * clinical assertion behavior run against the Python engine, NOT the frozen
 * in-browser extractor. The former `it.fails` gap cases (termination cues, long
 * denial lists, inline 'history of', 'rule out', conditional 'if X recurs') are
 * now covered there:
 *   - tests/test_clinical_edge_cases.py  (resolver-level assertion vocabulary)
 *   - tests/test_engine_acceptance.py    (end-to-end envelope, ADR-001 accept.)
 *   - tests/test_rollup.py               (B6 conflict-aware rollup)
 *
 * What remains here are TS-side regression guards for fixes that live in the
 * rendering/legacy path (B6 conflict surfacing, C8 laterality) plus one
 * documented, still-open limitation (misspelling tolerance), which is gated on
 * the labeling plan — dictionary expansion is out of scope per the remediation
 * ground rules.
 */

const options: ExtractionOptions = { specialty: "mixed", mode: "auto" };

function byName(text: string, canonicalName: string): ClinicalEntity | undefined {
  return extractClinicalEntities(text, options).find((entity) => entity.canonicalName === canonicalName);
}

describe("clinical edge cases: copy-forward and contradiction", () => {
  it("B6 FIXED: contradicting mentions roll up to 'conflicting' with high review priority", () => {
    // Previously dedupeEntities made 'absent' sticky across merged mentions,
    // reporting the ACTIVE chest pain in the second sentence as denied.
    const text = "Denies chest pain.\nNow reports chest pain worse with exertion.";
    const chestPain = byName(text, "chest pain");
    expect(chestPain?.attributes?.assertion).toBe("conflicting");
    expect(chestPain?.uncertainty?.reviewPriority).toBe("high");
    expect(chestPain?.mentions).toHaveLength(2);
  });
});

describe("clinical edge cases: laterality", () => {
  it("C8 FIXED: a bare verb 'left' does not assign laterality (no anatomical anchor)", () => {
    const kneePain = byName("Patient left the clinic with knee pain.", "knee pain");
    expect(kneePain?.attributes?.laterality).toBeUndefined();
  });

  it("C8: laterality is assigned when anchored to a body site", () => {
    const kneePain = byName("Reports left knee pain after a fall.", "knee pain");
    expect(kneePain?.attributes?.laterality).toBe("left");
  });
});

describe("clinical edge cases: lexical robustness (OPEN, deferred)", () => {
  it("documents the current limitation: misspellings are dropped (fuzzy matching gated on the labeling plan)", () => {
    // Not yet fixed anywhere: there is no fuzzy/lexical-variant matching. This
    // guard pins the CURRENT behavior so a future fix flips it deliberately;
    // dictionary/lexicon expansion is driven by dev-split miss analysis, not by
    // padding here (audit B4 discipline, annotation plan B4).
    const entities = extractClinicalEntities("Patient has diabetis and hypertention.", options);
    expect(entities).toHaveLength(0);
  });
});
