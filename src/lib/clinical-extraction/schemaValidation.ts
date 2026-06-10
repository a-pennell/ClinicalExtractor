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

export type FhirValidationSummary = {
  resourceCount: number;
  resourceTypes: Record<string, number>;
};

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
  "conditional",
  "hypothetical",
  "historical",
  "family-history",
  "planned",
  "ordered",
  "conflicting",
  "unknown"
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
  const quality = validateFhirBundleQuality(payload);
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return { ok: false, errors: ["FHIR preview must be a JSON object."], warnings };
  }
  if (payload.resourceType !== "Bundle") {
    return { ok: false, errors: ["FHIR preview resourceType must be Bundle."], warnings };
  }
  if (!Array.isArray(payload.entry)) warnings.push("FHIR Bundle preview has no entry array.");
  warnings.push(...quality.warnings);
  if (!quality.ok) return { ok: false, errors: quality.errors, warnings };

  return { ok: true, value: { resourceType: "Bundle", type: typeof payload.type === "string" ? payload.type : "collection" }, warnings };
}

export function validateFhirBundleQuality(payload: unknown): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: FhirValidationSummary;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: FhirValidationSummary = { resourceCount: 0, resourceTypes: {} };

  if (!isRecord(payload)) {
    return { ok: false, errors: ["FHIR payload must be an object."], warnings, summary };
  }
  if (payload.resourceType !== "Bundle") errors.push("FHIR payload resourceType must be Bundle.");
  if (payload.type !== "collection") warnings.push("Prototype FHIR Bundle should use type=collection.");
  if (!Array.isArray(payload.entry)) {
    errors.push("FHIR Bundle must include an entry array.");
    return { ok: false, errors, warnings, summary };
  }

  payload.entry.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`FHIR entry ${index + 1} must be an object.`);
      return;
    }
    if (typeof entry.fullUrl !== "string" || !entry.fullUrl.startsWith("urn:uuid:")) {
      warnings.push(`FHIR entry ${index + 1} should use a urn:uuid fullUrl.`);
    }
    const resource = entry.resource;
    if (!isRecord(resource)) {
      errors.push(`FHIR entry ${index + 1} is missing a resource object.`);
      return;
    }
    validateFhirResource(resource, index + 1, errors, warnings, summary);
  });

  return { ok: errors.length === 0, errors, warnings, summary };
}

function validateFhirResource(
  resource: Record<string, unknown>,
  entryNumber: number,
  errors: string[],
  warnings: string[],
  summary: FhirValidationSummary
) {
  const resourceType = typeof resource.resourceType === "string" ? resource.resourceType : "";
  if (!resourceType) {
    errors.push(`FHIR entry ${entryNumber} resource is missing resourceType.`);
    return;
  }

  summary.resourceCount += 1;
  summary.resourceTypes[resourceType] = (summary.resourceTypes[resourceType] ?? 0) + 1;

  if (typeof resource.id !== "string" || !resource.id) errors.push(`FHIR ${resourceType} entry ${entryNumber} is missing id.`);
  if (!hasSubjectLikeReference(resource)) warnings.push(`FHIR ${resourceType} entry ${entryNumber} has no prototype subject/patient.`);

  if (["Condition", "Observation", "MedicationStatement", "AllergyIntolerance", "ServiceRequest", "Procedure"].includes(resourceType)) {
    const code = resourceType === "MedicationStatement" ? resource.medicationCodeableConcept : resource.code;
    if (!isCodeableConcept(code)) warnings.push(`FHIR ${resourceType} entry ${entryNumber} has no code text or coding.`);
    validateCodeableConcept(code, `FHIR ${resourceType} entry ${entryNumber}`, warnings);
  }

  if (resourceType === "Observation") {
    if (typeof resource.status !== "string") errors.push(`FHIR Observation entry ${entryNumber} is missing status.`);
    if (!("valueQuantity" in resource) && !("valueString" in resource) && !("component" in resource)) {
      warnings.push(`FHIR Observation entry ${entryNumber} has no value or component.`);
    }
  }

  if (resourceType === "ServiceRequest" && typeof resource.intent !== "string") {
    errors.push(`FHIR ServiceRequest entry ${entryNumber} is missing intent.`);
  }
}

function hasSubjectLikeReference(resource: Record<string, unknown>) {
  return isRecord(resource.subject) || isRecord(resource.patient);
}

function isCodeableConcept(value: unknown) {
  if (!isRecord(value)) return false;
  if (typeof value.text === "string" && value.text.trim()) return true;
  return Array.isArray(value.coding) && value.coding.length > 0;
}

function validateCodeableConcept(value: unknown, label: string, warnings: string[]) {
  if (!isRecord(value) || !Array.isArray(value.coding)) return;
  value.coding.forEach((coding, index) => {
    if (!isRecord(coding)) {
      warnings.push(`${label} coding ${index + 1} is not an object.`);
      return;
    }
    if (typeof coding.system !== "string" || !coding.system.startsWith("http")) {
      warnings.push(`${label} coding ${index + 1} has no absolute terminology system URI.`);
    }
    if (typeof coding.code !== "string" || !coding.code) warnings.push(`${label} coding ${index + 1} is missing code.`);
  });
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
