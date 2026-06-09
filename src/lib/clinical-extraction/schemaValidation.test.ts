import { describe, expect, it } from "vitest";
import { buildExtractionSession, buildFhirBundle } from "./documentOutput";
import { extractClinicalEntities } from "./extractClinicalEntities";
import { validateExtractionSessionPayload, validateFhirBundlePayload, validateFhirBundleQuality } from "./schemaValidation";

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

  it("summarizes generated FHIR Bundle resource quality", () => {
    const entities = extractClinicalEntities("HTN. BP 120/80. Continue lisinopril 20mg daily.", {
      specialty: "primary-care"
    });
    const result = validateFhirBundleQuality(buildFhirBundle(entities));

    expect(result.ok).toBe(true);
    expect(result.summary.resourceCount).toBeGreaterThan(0);
    expect(result.summary.resourceTypes.Observation).toBeGreaterThan(0);
  });

  it("rejects malformed FHIR Bundle resources", () => {
    const result = validateFhirBundleQuality({
      resourceType: "Bundle",
      type: "collection",
      entry: [{ fullUrl: "entity-1", resource: { resourceType: "Observation" } }]
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing id");
    expect(result.warnings.join(" ")).toContain("no value or component");
  });
});
