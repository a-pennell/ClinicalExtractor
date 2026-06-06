import type { CandidateCoding, ClinicalEntity } from "./types";

type FhirCoding = {
  system: string;
  code: string;
  display: string;
};

type FhirCodeableConcept = {
  coding?: FhirCoding[];
  text?: string;
};

type FhirPreviewResource = {
  resourceType: string;
  id: string;
  status?: string;
  intent?: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  subject?: { display: string };
  valueQuantity?: {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  component?: {
    code: FhirCodeableConcept;
    valueQuantity: {
      value: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }[];
  valueString?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  dosage?: { text: string }[];
  patient?: { display: string };
  criticality?: string;
  reaction?: {
    manifestation: FhirCodeableConcept[];
  }[];
  note?: { text: string }[];
};

const codingSystemUris: Record<CandidateCoding["system"], string> = {
  "ICD-10-CM": "http://hl7.org/fhir/sid/icd-10-cm",
  "SNOMED-CT": "http://snomed.info/sct",
  LOINC: "http://loinc.org",
  RxNorm: "http://www.nlm.nih.gov/research/umls/rxnorm",
  CPT: "http://www.ama-assn.org/go/cpt",
  HCPCS: "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"
};

export function buildFhirPreview(entity: ClinicalEntity): FhirPreviewResource {
  if (entity.type === "allergy") return buildAllergyIntolerance(entity);
  if (entity.type === "medication") return buildMedicationStatement(entity);
  if (
    entity.type === "plan" ||
    entity.type === "referral" ||
    entity.type === "imaging" ||
    entity.attributes?.assertion === "ordered"
  ) {
    return buildServiceRequest(entity);
  }
  if (["lab", "vital", "score", "finding", "severity", "special-test"].includes(entity.type)) {
    return buildObservation(entity);
  }
  if (entity.type === "procedure" || entity.type === "exercise") return buildProcedure(entity);

  return buildCondition(entity);
}

function buildCondition(entity: ClinicalEntity): FhirPreviewResource {
  const assertion = entity.attributes?.assertion ?? "present";

  return {
    resourceType: "Condition",
    id: entity.id,
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: assertion === "absent" ? "inactive" : "active",
          display: assertion === "absent" ? "Inactive" : "Active"
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: assertion === "absent" ? "refuted" : "unconfirmed",
          display: assertion === "absent" ? "Refuted" : "Unconfirmed"
        }
      ]
    },
    code: toCodeableConcept(entity),
    subject: prototypeSubject(),
    note: sourceNotes(entity)
  };
}

function buildObservation(entity: ClinicalEntity): FhirPreviewResource {
  const value = entity.attributes?.value;
  const numericValue = value ? Number.parseFloat(value) : Number.NaN;
  const observation: FhirPreviewResource = {
    resourceType: "Observation",
    id: entity.id,
    status: "final",
    code: toCodeableConcept(entity),
    category: entity.type === "vital" ? [vitalSignsCategory()] : undefined,
    subject: prototypeSubject(),
    note: sourceNotes(entity)
  };

  if (entity.canonicalName === "blood pressure" && entity.attributes?.systolic && entity.attributes.diastolic) {
    observation.component = [
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8480-6",
              display: "Systolic blood pressure"
            }
          ],
          text: "Systolic blood pressure"
        },
        valueQuantity: toValueQuantity(entity.attributes.systolic, "mmHg")
      },
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8462-4",
              display: "Diastolic blood pressure"
            }
          ],
          text: "Diastolic blood pressure"
        },
        valueQuantity: toValueQuantity(entity.attributes.diastolic, "mmHg")
      }
    ];
    return observation;
  }

  if (value && Number.isFinite(numericValue)) {
    observation.valueQuantity = toValueQuantity(value, entity.attributes?.unit ?? entity.attributes?.scale);
  } else if (value) {
    observation.valueString = value;
  }

  return observation;
}

function buildMedicationStatement(entity: ClinicalEntity): FhirPreviewResource {
  return {
    resourceType: "MedicationStatement",
    id: entity.id,
    status: entity.attributes?.assertion === "absent" ? "not-taken" : "active",
    medicationCodeableConcept: toCodeableConcept(entity),
    subject: prototypeSubject(),
    dosage: entity.attributes?.sig || entity.attributes?.dose ? [{ text: entity.attributes.sig ?? entity.attributes.dose! }] : undefined,
    note: sourceNotes(entity)
  };
}

function buildAllergyIntolerance(entity: ClinicalEntity): FhirPreviewResource {
  const assertion = entity.attributes?.assertion ?? "present";

  return {
    resourceType: "AllergyIntolerance",
    id: entity.id,
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: assertion === "absent" ? "inactive" : "active",
          display: assertion === "absent" ? "Inactive" : "Active"
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: assertion === "absent" ? "refuted" : "unconfirmed",
          display: assertion === "absent" ? "Refuted" : "Unconfirmed"
        }
      ]
    },
    criticality: entity.attributes?.severity === "high" ? "high" : undefined,
    code: toCodeableConcept(entity),
    patient: prototypeSubject(),
    reaction: entity.attributes?.reaction
      ? [
          {
            manifestation: [
              {
                text: entity.attributes.reaction
              }
            ]
          }
        ]
      : undefined,
    note: sourceNotes(entity)
  };
}

function buildServiceRequest(entity: ClinicalEntity): FhirPreviewResource {
  return {
    resourceType: "ServiceRequest",
    id: entity.id,
    status: "active",
    intent: entity.attributes?.assertion === "ordered" ? "order" : "plan",
    code: toCodeableConcept(entity),
    subject: prototypeSubject(),
    note: sourceNotes(entity)
  };
}

function buildProcedure(entity: ClinicalEntity): FhirPreviewResource {
  return {
    resourceType: "Procedure",
    id: entity.id,
    status: "completed",
    code: toCodeableConcept(entity),
    subject: prototypeSubject(),
    note: sourceNotes(entity)
  };
}

function toCodeableConcept(entity: ClinicalEntity): FhirCodeableConcept {
  const codings = getReviewReadyCodings(entity);

  return {
    coding: codings.map((coding) => ({
      system: codingSystemUris[coding.system],
      code: coding.code,
      display: coding.display
    })),
    text: entity.displayName
  };
}

function getReviewReadyCodings(entity: ClinicalEntity) {
  const selectedCodings = entity.codings?.filter((coding) => coding.status === "selected") ?? [];
  if (selectedCodings.length) return selectedCodings;
  return entity.codings?.filter((coding) => coding.status !== "rejected") ?? [];
}

function sourceNotes(entity: ClinicalEntity) {
  return entity.mentions.map((mention) => ({
    text: `Source span ${mention.start}-${mention.end}: ${mention.text}`
  }));
}

function prototypeSubject() {
  return { display: "Prototype patient" };
}

function vitalSignsCategory(): FhirCodeableConcept {
  return {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: "vital-signs",
        display: "Vital Signs"
      }
    ],
    text: "Vital Signs"
  };
}

function toValueQuantity(value: string, unit?: string) {
  const normalizedUnit = normalizeUcumUnit(unit);

  return {
    value: Number.parseFloat(value),
    unit,
    system: normalizedUnit ? "http://unitsofmeasure.org" : undefined,
    code: normalizedUnit
  };
}

function normalizeUcumUnit(unit?: string) {
  if (!unit) return undefined;
  const unitMap: Record<string, string> = {
    mmHg: "mm[Hg]",
    "beats/min": "{beats}/min",
    "breaths/min": "{breaths}/min",
    "%": "%",
    Cel: "Cel",
    degF: "[degF]",
    kg: "kg",
    lb: "[lb_av]"
  };
  return unitMap[unit] ?? unit;
}
