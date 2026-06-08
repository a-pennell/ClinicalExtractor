import { buildEntitySummary, buildTerminologyManifest, type ExtractionSession } from "./documentOutput";
import type {
  AssertionStatus,
  CandidateCoding,
  ClinicalEntity,
  ClinicalEntityType,
  Confidence,
  EntityMention,
  Specialty,
  TerminologySystem
} from "./types";

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const specialties: Specialty[] = ["primary-care", "mental-health", "physical-therapy", "mixed"];
const entityTypes: ClinicalEntityType[] = [
  "problem",
  "symptom",
  "finding",
  "medication",
  "allergy",
  "procedure",
  "lab",
  "vital",
  "score",
  "body-site",
  "laterality",
  "duration",
  "severity",
  "functional-limitation",
  "plan",
  "referral",
  "imaging",
  "exercise",
  "special-test",
  "risk",
  "other"
];
const confidenceValues: Confidence[] = ["high", "medium", "low"];
const assertionValues: AssertionStatus[] = [
  "present",
  "absent",
  "possible",
  "historical",
  "family-history",
  "planned",
  "ordered"
];
const terminologySystems: TerminologySystem[] = ["ICD-10-CM", "SNOMED-CT", "LOINC", "RxNorm", "CPT", "HCPCS"];

export function validateExtractionSessionPayload(payload: unknown): ValidationResult<ExtractionSession> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return { ok: false, errors: ["Imported file must contain a JSON object."], warnings };
  }

  if (payload.schemaVersion !== "prototype-1") errors.push("Unsupported or missing schemaVersion.");
  if (!isSpecialty(payload.specialty)) errors.push("Missing or invalid specialty.");
  if (typeof payload.sourceText !== "string") errors.push("Missing sourceText.");
  if (!Array.isArray(payload.entities)) errors.push("Missing entities array.");

  const entities = Array.isArray(payload.entities)
    ? payload.entities.flatMap((entity, index) => {
        const result = validateClinicalEntity(entity, index);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        return result.entity ? [result.entity] : [];
      })
    : [];

  if (errors.length) return { ok: false, errors, warnings };

  const specialty = payload.specialty as Specialty;
  const session: ExtractionSession = {
    schemaVersion: "prototype-1",
    specialty,
    specialtyLabel: typeof payload.specialtyLabel === "string" ? payload.specialtyLabel : specialty,
    sourceText: payload.sourceText as string,
    sections: Array.isArray(payload.sections) ? (payload.sections as ExtractionSession["sections"]) : [],
    summary: buildEntitySummary(entities),
    terminology: buildTerminologyManifest(entities),
    entities
  };

  if (!payload.summary) warnings.push("Summary was rebuilt during import.");
  if (!payload.terminology) warnings.push("Terminology manifest was rebuilt during import.");

  return { ok: true, value: session, warnings };
}

export function validateFhirBundlePayload(payload: unknown): ValidationResult<{ resourceType: "Bundle"; type: string }> {
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return { ok: false, errors: ["FHIR preview must be a JSON object."], warnings };
  }
  if (payload.resourceType !== "Bundle") {
    return { ok: false, errors: ["FHIR preview resourceType must be Bundle."], warnings };
  }
  if (!Array.isArray(payload.entry)) warnings.push("FHIR Bundle preview has no entry array.");

  return { ok: true, value: { resourceType: "Bundle", type: typeof payload.type === "string" ? payload.type : "collection" }, warnings };
}

function validateClinicalEntity(value: unknown, index: number) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return { entity: null, errors: [`Entity ${index + 1} must be an object.`], warnings };
  }

  if (typeof value.id !== "string") errors.push(`Entity ${index + 1} is missing id.`);
  if (typeof value.canonicalName !== "string") errors.push(`Entity ${index + 1} is missing canonicalName.`);
  if (typeof value.displayName !== "string") errors.push(`Entity ${index + 1} is missing displayName.`);
  if (!isEntityType(value.type)) errors.push(`Entity ${index + 1} has invalid type.`);
  if (!isConfidence(value.confidence)) errors.push(`Entity ${index + 1} has invalid confidence.`);
  if (!Array.isArray(value.mentions)) errors.push(`Entity ${index + 1} is missing mentions.`);

  const mentions = Array.isArray(value.mentions)
    ? value.mentions.flatMap((mention, mentionIndex) => {
        const validMention = validateMention(mention);
        if (!validMention) {
          errors.push(`Entity ${index + 1} mention ${mentionIndex + 1} is invalid.`);
          return [];
        }
        return [validMention];
      })
    : [];

  const codings = Array.isArray(value.codings)
    ? value.codings.flatMap((coding, codingIndex) => {
        const validCoding = validateCoding(coding);
        if (!validCoding) {
          warnings.push(`Entity ${index + 1} coding ${codingIndex + 1} was dropped during import.`);
          return [];
        }
        return [validCoding];
      })
    : undefined;

  if (errors.length) return { entity: null, errors, warnings };

  const entity: ClinicalEntity = {
    ...(value as ClinicalEntity),
    id: value.id as string,
    canonicalName: value.canonicalName as string,
    displayName: value.displayName as string,
    type: value.type as ClinicalEntityType,
    specialties: Array.isArray(value.specialties)
      ? value.specialties.filter(isSpecialty)
      : [],
    mentions,
    attributes: sanitizeAttributes(value.attributes),
    codings,
    confidence: value.confidence as Confidence
  };

  if (!entity.specialties.length) warnings.push(`Entity ${index + 1} had no valid specialties.`);
  return { entity, errors, warnings };
}

function validateMention(value: unknown): EntityMention | null {
  if (!isRecord(value)) return null;
  if (typeof value.text !== "string" || typeof value.start !== "number" || typeof value.end !== "number") return null;
  return value as EntityMention;
}

function validateCoding(value: unknown): CandidateCoding | null {
  if (!isRecord(value)) return null;
  if (!isTerminologySystem(value.system)) return null;
  if (typeof value.code !== "string" || typeof value.display !== "string") return null;
  if (!isConfidence(value.confidence)) return null;
  return value as CandidateCoding;
}

function sanitizeAttributes(value: unknown): ClinicalEntity["attributes"] | undefined {
  if (!isRecord(value)) return undefined;
  if (value.assertion && !assertionValues.includes(value.assertion as AssertionStatus)) {
    return { ...value, assertion: undefined } as ClinicalEntity["attributes"];
  }
  return value as ClinicalEntity["attributes"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSpecialty(value: unknown): value is Specialty {
  return specialties.includes(value as Specialty);
}

function isEntityType(value: unknown): value is ClinicalEntityType {
  return entityTypes.includes(value as ClinicalEntityType);
}

function isConfidence(value: unknown): value is Confidence {
  return confidenceValues.includes(value as Confidence);
}

function isTerminologySystem(value: unknown): value is TerminologySystem {
  return terminologySystems.includes(value as TerminologySystem);
}
