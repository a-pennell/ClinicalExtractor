import { describe, expect, it } from "vitest";
import { buildClipboardSummary, buildExtractionSession, buildFhirBundle, buildReviewerReport } from "./documentOutput";
import { extractClinicalEntities } from "./extractClinicalEntities";

describe("documentOutput", () => {
  it("builds a document-level extraction session with summary counts", () => {
    const entities = extractClinicalEntities("HTN. BP 128/82. A1c 7.8.", { specialty: "primary-care" });
    const session = buildExtractionSession("HTN. BP 128/82. A1c 7.8.", "primary-care", entities);

    expect(session.schemaVersion).toBe("prototype-1");
    expect(session.summary.entityCount).toBe(entities.length);
    expect(session.summary.byType.problem).toBe(1);
    expect(session.summary.byType.vital).toBe(1);
    expect(session.summary.byType.lab).toBe(1);
    expect(session.terminology.provider.contentVersion).toBe("prototype-2026-06");
    expect(session.terminology.systems.some((system) => system.system === "ICD-10-CM")).toBe(true);
  });

  it("builds a FHIR Bundle preview from extracted entities", () => {
    const entities = extractClinicalEntities("Major depression. PHQ-9 18.", { specialty: "mental-health" });
    const bundle = buildFhirBundle(entities);

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    expect(bundle.entry.length).toBe(entities.length);
    expect(bundle.entry.some((entry) => entry.resource.resourceType === "Condition")).toBe(true);
    expect(bundle.entry.some((entry) => entry.resource.resourceType === "Observation")).toBe(true);
  });

  it("builds reviewer-friendly report and clipboard summaries", () => {
    const text = "HTN. BP 128/82.";
    const entities = extractClinicalEntities(text, { specialty: "primary-care" });
    const report = buildReviewerReport(text, "primary-care", entities);
    const summary = buildClipboardSummary(entities);

    expect(report).toContain("# Clinical Entity Extraction Review");
    expect(report).toContain("Local static terminology map");
    expect(report).toContain("Hypertension");
    expect(summary).toContain("Hypertension (problem; present;");
    expect(summary).toContain("Blood pressure");
  });
});
