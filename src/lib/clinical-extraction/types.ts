export type Specialty = "primary-care" | "mental-health" | "physical-therapy" | "mixed";

export type ClinicalEntityType =
  | "problem"
  | "symptom"
  | "finding"
  | "medication"
  | "allergy"
  | "procedure"
  | "lab"
  | "vital"
  | "score"
  | "body-site"
  | "laterality"
  | "duration"
  | "severity"
  | "functional-limitation"
  | "plan"
  | "referral"
  | "imaging"
  | "exercise"
  | "special-test"
  | "risk"
  | "other";

export type AssertionStatus =
  | "present"
  | "absent"
  | "possible"
  | "historical"
  | "family-history"
  | "planned"
  | "ordered"
  // B6: entity-level status when merged mentions disagree; never resolves
  // silently to absent or present. Always high review priority.
  | "conflicting";

export type Confidence = "high" | "medium" | "low";

export type ClinicalSectionName =
  | "chief-complaint"
  | "history-of-present-illness"
  | "review-of-systems"
  | "past-medical-history"
  | "medications"
  | "allergies"
  | "social-history"
  | "family-history"
  | "subjective"
  | "objective"
  | "assessment"
  | "plan"
  | "assessment-plan"
  | "unknown";

export type ClinicalSection = {
  id: string;
  title: string;
  normalizedName: ClinicalSectionName;
  start: number;
  end: number;
};

export type TerminologySystem =
  | "ICD-10-CM"
  | "SNOMED-CT"
  | "LOINC"
  | "RxNorm"
  | "CPT"
  | "HCPCS";

export type CodingStatus = "candidate" | "selected" | "rejected";

export type EntityReviewStatus = "unreviewed" | "reviewed" | "edited" | "manual";

export type CandidateCoding = {
  system: TerminologySystem;
  code: string;
  display: string;
  version?: string;
  confidence: Confidence;
  status: CodingStatus;
  rationale?: string;
};

export type EntityMention = {
  text: string;
  start: number;
  end: number;
  sentence?: string;
  section?: ClinicalSectionName;
};

export type EntityRelationType =
  | "treats"
  | "measures"
  | "ordered-for"
  | "documents"
  | "supports"
  | "plan-for";

export type RelationStatus = "candidate" | "accepted" | "rejected";

export type EntityRelation = {
  type: EntityRelationType;
  targetEntityId: string;
  targetCanonicalName: string;
  targetDisplayName: string;
  confidence: Confidence;
  status: RelationStatus;
  explanation: string;
};

export type EntityUncertainty = {
  reviewPriority: "routine" | "needs-review" | "high";
  reasons: string[];
};

export type ClinicalEntity = {
  id: string;
  canonicalName: string;
  displayName: string;
  type: ClinicalEntityType;
  specialties: Specialty[];
  mentions: EntityMention[];
  attributes?: {
    value?: string;
    unit?: string;
    scale?: string;
    systolic?: string;
    diastolic?: string;
    dose?: string;
    route?: string;
    frequency?: string;
    sig?: string;
    prn?: boolean;
    indication?: string;
    duration?: string;
    severity?: string;
    substance?: string;
    reaction?: string;
    familyMember?: string;
    modality?: string;
    bodySite?: string;
    laterality?: "left" | "right" | "bilateral" | "unspecified";
    assertion?: AssertionStatus;
    temporality?: "current" | "past" | "chronic" | "acute" | "resolved" | "unknown";
    normalizedTerm?: string;
  };
  codings?: CandidateCoding[];
  relations?: EntityRelation[];
  uncertainty?: EntityUncertainty;
  confidence: Confidence;
  explanation?: string;
  review?: {
    status: EntityReviewStatus;
    note?: string;
  };
  disambiguation?: {
    abbreviation: string;
    chosenMeaning?: string;
    possibleMeanings: string[];
    reason?: string;
    source?: string;
    evidence?: string[];
    mentionCount?: number;
  };
};

export type EntityPattern = {
  canonicalName: string;
  displayName?: string;
  type: ClinicalEntityType;
  terms: string[];
  specialties: Specialty[];
  confidence?: Confidence;
};

export type ExtractionOptions = {
  specialty?: Specialty;
  mode?: "auto" | "override";
};

export type DetectedClinicalContext = {
  primarySpecialty: Specialty;
  activeSpecialties: Specialty[];
  specialtyScores: Record<Specialty, number>;
  noteType: "soap" | "eval" | "progress-note" | "plan" | "unknown";
  sectionSignals: string[];
  lexicalSignals: string[];
  ambiguityWarnings: {
    abbreviation: string;
    possibleMeanings: string[];
    chosenMeaning?: string;
    reason?: string;
    source?: string;
    evidence?: string[];
    mentionCount?: number;
  }[];
};

export type Segment = {
  text: string;
  start: number;
  end: number;
  section?: ClinicalSectionName;
};
