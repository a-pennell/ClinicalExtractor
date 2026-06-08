import { describe, expect, it } from "vitest";
import { buildExtractionSession } from "./documentOutput";
import { extractClinicalEntities } from "./extractClinicalEntities";
import { validateExtractionSessionPayload, validateFhirBundlePayload } from "./schemaValidation";

describe("schemaValidation", () => {
  it("accepts exported extraction sessions and rebuilds derived metadata", () => {
    const entities = extractClinicalEntities("HTN. BP 120/80.", { specialty: "primary-care" });
    const session = buildExtractionSession("HTN. BP 120/80.", "primary-care", entities);
    const result = validateExtractionSessionPayload(session);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.entityCount).toBe(entities.length);
      expect(result.value.terminology.provider.contentVersion).toBe("prototype-2026-06");
    }
  });

  it("rejects malformed extraction sessions", () => {
    const result = validateExtractionSessionPayload({
      schemaVersion: "prototype-1",
      specialty: "primary-care",
      sourceText: "HTN",
      entities: [{ canonicalName: "hypertension" }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("missing id");
  });

  it("validates basic FHIR Bundle preview shape", () => {
    expect(validateFhirBundlePayload({ resourceType: "Bundle", type: "collection", entry: [] }).ok).toBe(true);
    expect(validateFhirBundlePayload({ resourceType: "Patient" }).ok).toBe(false);
  });
});
