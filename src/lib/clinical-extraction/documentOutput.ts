import { buildFhirPreview } from "./fhirPreview";
import { detectClinicalSections } from "./sectionParser";
import { specialtyLabels } from "./specialtyProfiles";
import { TERMINOLOGY_CONTENT_VERSION, TERMINOLOGY_SYSTEM_VERSIONS } from "./terminologyMappings";
import type { ClinicalEntity, ClinicalEntityType, ClinicalSection, Specialty, TerminologySystem } from "./types";

export type TerminologyManifest = {
  provider: {
    id: "local-static";
    label: string;
    contentVersion: string;
    mode: "offline-prototype";
  };
  systems: {
    system: TerminologySystem;
    version: string;
    candidateCount: number;
    selectedCount: number;
    note: string;
  }[];
  limitations: string[];
};

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
  terminology: TerminologyManifest;
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
    terminology: buildTerminologyManifest(entities),
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

export function buildTerminologyManifest(entities: ClinicalEntity[]): TerminologyManifest {
  return {
    provider: {
      id: "local-static",
      label: "Local static terminology map",
      contentVersion: TERMINOLOGY_CONTENT_VERSION,
      mode: "offline-prototype"
    },
    systems: (Object.keys(TERMINOLOGY_SYSTEM_VERSIONS) as TerminologySystem[]).map((system) => {
      const codings = entities.flatMap((entity) => entity.codings?.filter((coding) => coding.system === system) ?? []);
      return {
        system,
        version: TERMINOLOGY_SYSTEM_VERSIONS[system],
        candidateCount: codings.length,
        selectedCount: codings.filter((coding) => coding.status === "selected").length,
        note: system === "ICD-10-CM" ? "Starter ICD-10-CM candidates are tagged to FY2026." : "Prototype-only local mapping; validate against an authoritative terminology service before clinical or billing use."
      };
    }),
    limitations: [
      "Mappings are starter candidates, not final coding recommendations.",
      "No external terminology server, eligibility logic, payer policy, or coding guideline validation is used.",
      "Version metadata describes the local map posture and may not match a production terminology release."
    ]
  };
}

export function buildReviewerReport(text: string, specialty: Specialty, entities: ClinicalEntity[]) {
  const session = buildExtractionSession(text, specialty, entities);
  const lines = [
    "# Clinical Entity Extraction Review",
    "",
    `Specialty: ${session.specialtyLabel}`,
    `Entity count: ${session.summary.entityCount}`,
    `Reviewed: ${session.summary.reviewedCount}`,
    `Selected codes: ${session.summary.selectedCodingCount}`,
    `High priority review: ${session.summary.highPriorityReviewCount}`,
    "",
    "## Terminology",
    `${session.terminology.provider.label} (${session.terminology.provider.contentVersion})`,
    ...session.terminology.systems
      .filter((system) => system.candidateCount > 0 || system.selectedCount > 0)
      .map((system) => `- ${system.system} ${system.version}: ${system.candidateCount} candidates, ${system.selectedCount} selected`),
    "",
    "## Entities",
    ...entities.map((entity) => {
      const assertion = entity.attributes?.assertion ?? "present";
      const selectedCodes = entity.codings
        ?.filter((coding) => coding.status === "selected")
        .map((coding) => `${coding.system} ${coding.code}`)
        .join(", ");
      const mentionText = entity.mentions.map((mention) => `"${mention.text}"`).join("; ");
      return [
        `### ${entity.displayName}`,
        `Type: ${entity.type}`,
        `Assertion: ${assertion}`,
        `Confidence: ${entity.confidence}`,
        `Review: ${entity.review?.status ?? "unreviewed"}`,
        selectedCodes ? `Selected codes: ${selectedCodes}` : "Selected codes: none",
        `Source: ${mentionText || "none"}`,
        entity.review?.note ? `Reviewer note: ${entity.review.note}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "",
    "## Source Text",
    text.trim() || "(blank)"
  ];

  return lines.join("\n");
}

export function buildClipboardSummary(entities: ClinicalEntity[]) {
  if (!entities.length) return "No extracted clinical entities.";

  return entities
    .map((entity) => {
      const assertion = entity.attributes?.assertion ?? "present";
      const value = entity.attributes?.value
        ? `; value ${entity.attributes.value}${entity.attributes.unit ? ` ${entity.attributes.unit}` : ""}`
        : "";
      return `${entity.displayName} (${entity.type}; ${assertion}; ${entity.confidence} confidence${value})`;
    })
    .join("\n");
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
