import { describe, expect, it } from "vitest";
import { extractClinicalEntities } from "./extractClinicalEntities";
import type { ClinicalEntity, ExtractionOptions } from "./types";

/**
 * AUDIT EDGE-CASE TESTS (docs/pre-review-audit.md) — FROZEN LEGACY EXTRACTOR.
 *
 * Post-ADR-001 these `it.fails` cases document gaps in the FROZEN in-browser
 * extractor that will NOT be fixed (the TS inference path is demoted to a
 * fallback). The authoritative, PASSING acceptance tests for this behavior run
 * against the Python engine:
 *   - tests/test_clinical_edge_cases.py  (resolver-level assertion vocabulary)
 *   - tests/test_engine_acceptance.py    (end-to-end envelope, ADR-001 §accept.)
 *   - tests/test_rollup.py               (B6 conflict-aware rollup)
 * Laterality (C8) is handled in Phase 6; misspelling tolerance is gated on the
 * labeling plan (dictionary expansion is out of scope per the remediation
 * ground rules). These TS copies remain only as a record of the legacy gaps.
 */

const options: ExtractionOptions = { specialty: "mixed", mode: "auto" };

function byName(text: string, canonicalName: string): ClinicalEntity | undefined {
  return extractClinicalEntities(text, options).find((entity) => entity.canonicalName === canonicalName);
}

describe("clinical edge cases: negation scope", () => {
  it.fails("GAP: termination cue ('but') should end negation scope", () => {
    // "cough" sits 13 chars after "No", inside the 36-char isNegated window;
    // negationRules.ts has no termination cues, so the affirmed finding is
    // reported absent.
    const cough = byName("No fever but cough is present.", "cough");
    expect(cough?.attributes?.assertion).toBe("present");
  });

  it.fails("GAP: negation should cover full denial lists, not a 36-char window", () => {
    // "headache" falls outside the fixed lookbehind window and silently flips
    // to PRESENT — a false positive finding from an explicit denial.
    const headache = byName("No fever, chills, cough, vomiting, diarrhea, or headache.", "headache");
    expect(headache?.attributes?.assertion).toBe("absent");
  });
});

describe("clinical edge cases: temporality and subject", () => {
  it.fails("GAP: inline 'history of X' outside a PMH section should not be an active finding", () => {
    // Temporality is only inferred from section headers (past-medical-history);
    // narrative "history of" is ignored.
    const asthma = byName("History of asthma. Currently no wheezing.", "asthma");
    expect(asthma?.attributes?.temporality).toBe("past");
  });

  it.fails("GAP: 'rule out X' should be hypothetical, not present", () => {
    const asthma = byName("Rule out asthma.", "asthma");
    expect(asthma?.attributes?.assertion).not.toBe("present");
  });

  it.fails("GAP: conditional 'if X recurs' should be hypothetical, not present", () => {
    const chestPain = byName("If chest pain recurs, go to the ED.", "chest pain");
    expect(chestPain?.attributes?.assertion).not.toBe("present");
  });
});

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
  it.fails("GAP: the verb 'left' should not assign laterality", () => {
    // detectLaterality regex-matches l/left/r/right against the first 24 chars
    // of the sentence, so "Patient left the clinic" lateralizes the knee.
    const kneePain = byName("Patient left the clinic with knee pain.", "knee pain");
    expect(kneePain?.attributes?.laterality).toBeUndefined();
  });
});

describe("clinical edge cases: lexical robustness", () => {
  it.fails("GAP: common misspellings are dropped entirely (no fuzzy matching)", () => {
    const entities = extractClinicalEntities("Patient has diabetis and hypertention.", options);
    expect(entities.length).toBeGreaterThan(0);
  });
});
