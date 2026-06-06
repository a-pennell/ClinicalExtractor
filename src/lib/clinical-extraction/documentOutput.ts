import { buildFhirPreview } from "./fhirPreview";
import { detectClinicalSections } from "./sectionParser";
import { specialtyLabels } from "./specialtyProfiles";
import type { ClinicalEntity, ClinicalEntityType, ClinicalSection, Specialty } from "./types";

export type ExtractionSession = {
  schemaVersion: "prototype-1";
  specialty: Specialty;
  specialtyLabel: string;
  sourceText: string;
  sections: ClinicalSection[];
  summary: {
    entityCount: number;
    reviewedCount: number;
    selectedCodingCount: number;
    relationCount: number;
    highPriorityReviewCount: number;
    byType: Partial<Record<ClinicalEntityType, number>>;
  };
  entities: ClinicalEntity[];
};

export type FhirBundlePreview = {
  resourceType: "Bundle";
  type: "collection";
  entry: {
    fullUrl: string;
    resource: ReturnType<typeof buildFhirPreview>;
  }[];
};

export function buildExtractionSession(text: string, specialty: Specialty, entities: ClinicalEntity[]): ExtractionSession {
  return {
    schemaVersion: "prototype-1",
    specialty,
    specialtyLabel: specialtyLabels[specialty],
    sourceText: text,
    sections: detectClinicalSections(text),
    summary: buildEntitySummary(entities),
    entities
  };
}

export function buildFhirBundle(entities: ClinicalEntity[]): FhirBundlePreview {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entities.map((entity) => ({
      fullUrl: `urn:uuid:${entity.id}`,
      resource: buildFhirPreview(entity)
    }))
  };
}

export function buildEntitySummary(entities: ClinicalEntity[]): ExtractionSession["summary"] {
  return {
    entityCount: entities.length,
    reviewedCount: entities.filter((entity) => entity.review?.status && entity.review.status !== "unreviewed").length,
    selectedCodingCount: entities.reduce(
      (count, entity) => count + (entity.codings?.filter((coding) => coding.status === "selected").length ?? 0),
      0
    ),
    relationCount: entities.reduce((count, entity) => count + (entity.relations?.length ?? 0), 0),
    highPriorityReviewCount: entities.filter((entity) => entity.uncertainty?.reviewPriority === "high").length,
    byType: entities.reduce<Partial<Record<ClinicalEntityType, number>>>((summary, entity) => {
      summary[entity.type] = (summary[entity.type] ?? 0) + 1;
      return summary;
    }, {})
  };
}
