import { describe, expect, it } from "vitest";
import { extractClinicalEntities } from "./extractClinicalEntities";
import type { ClinicalEntity, ExtractionOptions } from "./types";

/**
 * AUDIT EDGE-CASE TESTS (docs/pre-review-audit.md).
 *
 * Tests written with `it.fails` document KNOWN GAPS confirmed empirically
 * during the pre-review audit: they pass only because the inner expectation
 * fails. When the gap is fixed, the `it.fails` test will start failing —
 * remove the modifier and keep the assertion as a regression test.
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
