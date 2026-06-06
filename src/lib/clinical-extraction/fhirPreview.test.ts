import { describe, expect, it } from "vitest";
import { buildFhirPreview } from "./fhirPreview";
import { extractClinicalEntities } from "./extractClinicalEntities";

describe("buildFhirPreview", () => {
  it("maps diagnosis-like entities to Condition resources", () => {
    const entity = extractClinicalEntities("Major depression.", { specialty: "mental-health" }).find(
      (candidate) => candidate.canonicalName === "major depressive disorder"
    );

    expect(entity).toBeTruthy();
    const preview = buildFhirPreview(entity!);

    expect(preview.resourceType).toBe("Condition");
    expect(preview.code?.coding?.some((coding) => coding.system.includes("icd-10-cm") && coding.code === "F32.9")).toBe(
      true
    );
  });

  it("maps scored observations to Observation resources", () => {
    const entity = extractClinicalEntities("PHQ-9 18.", { specialty: "mental-health" }).find(
      (candidate) => candidate.canonicalName === "Patient Health Questionnaire-9"
    );

    expect(entity).toBeTruthy();
    const preview = buildFhirPreview(entity!);

    expect(preview.resourceType).toBe("Observation");
    expect(preview.valueQuantity?.value).toBe(18);
    expect(preview.code?.coding?.some((coding) => coding.system === "http://loinc.org")).toBe(true);
  });

  it("prefers selected codings and omits rejected codings in FHIR previews", () => {
    const entity = extractClinicalEntities("Major depression.", { specialty: "mental-health" }).find(
      (candidate) => candidate.canonicalName === "major depressive disorder"
    );

    expect(entity).toBeTruthy();
    const reviewedEntity = {
      ...entity!,
      codings: entity!.codings?.map((coding) => {
        if (coding.system === "SNOMED-CT") return { ...coding, status: "selected" as const };
        if (coding.system === "ICD-10-CM") return { ...coding, status: "rejected" as const };
        return coding;
      })
    };
    const preview = buildFhirPreview(reviewedEntity);

    expect(preview.code?.coding).toHaveLength(1);
    expect(preview.code?.coding?.[0].system).toBe("http://snomed.info/sct");
  });

  it("maps blood pressure to systolic and diastolic Observation components", () => {
    const entity = extractClinicalEntities("BP 128/82.", { specialty: "primary-care" }).find(
      (candidate) => candidate.canonicalName === "blood pressure"
    );

    expect(entity).toBeTruthy();
    const preview = buildFhirPreview(entity!);

    expect(preview.resourceType).toBe("Observation");
    expect(preview.valueQuantity).toBeUndefined();
    expect(preview.component).toHaveLength(2);
    expect(preview.component?.[0]).toMatchObject({
      code: { coding: [{ system: "http://loinc.org", code: "8480-6" }] },
      valueQuantity: { value: 128, code: "mm[Hg]" }
    });
    expect(preview.component?.[1]).toMatchObject({
      code: { coding: [{ system: "http://loinc.org", code: "8462-4" }] },
      valueQuantity: { value: 82, code: "mm[Hg]" }
    });
  });

  it("maps allergy entities to AllergyIntolerance resources", () => {
    const entity = extractClinicalEntities("Allergy: penicillin - rash.", { specialty: "primary-care" }).find(
      (candidate) => candidate.canonicalName === "penicillin allergy"
    );

    expect(entity).toBeTruthy();
    const preview = buildFhirPreview(entity!);

    expect(preview.resourceType).toBe("AllergyIntolerance");
    expect(preview.code?.text).toBe("Penicillin allergy");
    expect(preview.patient?.display).toBe("Prototype patient");
    expect(preview.reaction?.[0].manifestation[0].text).toBe("rash");
  });

  it("maps medication sig details to MedicationStatement dosage text", () => {
    const entity = extractClinicalEntities("sertraline 100mg PO qAM.", { specialty: "mental-health" }).find(
      (candidate) => candidate.canonicalName === "sertraline"
    );

    expect(entity).toBeTruthy();
    const preview = buildFhirPreview(entity!);

    expect(preview.resourceType).toBe("MedicationStatement");
    expect(preview.dosage?.[0].text).toBe("100 mg PO every morning");
  });

  it("maps ordered imaging and referrals to ServiceRequest resources", () => {
    const imaging = extractClinicalEntities("Ordered MRI lumbar spine. Referral to PT.", { specialty: "mixed" }).find(
      (candidate) => candidate.canonicalName === "lumbar spine MRI"
    );
    const referral = extractClinicalEntities("Ordered MRI lumbar spine. Referral to PT.", { specialty: "mixed" }).find(
      (candidate) => candidate.canonicalName === "referral to physical therapy"
    );

    expect(buildFhirPreview(imaging!).resourceType).toBe("ServiceRequest");
    expect(buildFhirPreview(imaging!).intent).toBe("order");
    expect(buildFhirPreview(referral!).resourceType).toBe("ServiceRequest");
    expect(buildFhirPreview(referral!).intent).toBe("plan");
  });
});
