import { describe, expect, it } from "vitest";
import { addCandidateCodings, localTerminologyLookup, lookupCandidateCodings } from "./terminologyMappings";
import type { TerminologyLookup } from "./terminologyMappings";
import type { ClinicalEntity } from "./types";

describe("terminologyMappings", () => {
  it("exposes a local terminology lookup abstraction", () => {
    const codings = lookupCandidateCodings({
      canonicalName: "thyroid stimulating hormone",
      type: "lab",
      attributes: { normalizedTerm: "thyroid stimulating hormone" }
    });

    expect(codings.some((coding) => coding.system === "LOINC" && coding.code === "3016-3")).toBe(true);
  });

  it("supports dynamic candidate codings for modality-based imaging entities", () => {
    const codings = lookupCandidateCodings({
      canonicalName: "lumbar spine MRI",
      type: "imaging",
      attributes: { modality: "MRI", bodySite: "lumbar spine" }
    });

    expect(codings.some((coding) => coding.system === "SNOMED-CT" && coding.code === "113091000")).toBe(true);
  });

  it("allows candidate coding lookup to be swapped", () => {
    const entity: ClinicalEntity = {
      id: "test-entity",
      canonicalName: "custom concept",
      displayName: "Custom concept",
      type: "finding",
      specialties: ["mixed"],
      mentions: [{ text: "custom concept", start: 0, end: 14 }],
      confidence: "medium"
    };
    const customLookup: TerminologyLookup = {
      lookupCandidates() {
        return [
          {
            system: "SNOMED-CT",
            code: "123",
            display: "Custom code",
            confidence: "low",
            status: "candidate"
          }
        ];
      }
    };

    expect(localTerminologyLookup.lookupCandidates(entity)).toHaveLength(0);
    expect(addCandidateCodings(entity, customLookup).codings?.[0].code).toBe("123");
  });
});
