import type { ClinicalEntity } from "../types";

export const RISK_FEATURE_NAMES = [
  "entity_count",
  "problem_count_present",
  "medication_count",
  "plan_count",
  "functional_limitation_count",
  "high_priority_count",
  "pain_rating__last",
  "pain_rating__missing",
  "heart_rate__mean",
  "heart_rate__missing",
  "bp_systolic__last",
  "bp_diastolic__last",
  "bp_missing",
  "phq9__max",
  "phq9__missing",
  "gad7__max",
  "si__present",
  "si__explicitly_negated"
] as const;

export type RiskFeatureName = (typeof RISK_FEATURE_NAMES)[number];
export type RiskFeatureVector = Record<RiskFeatureName, number>;

export type RiskFeaturePreviewRow = {
  feature: RiskFeatureName;
  value: string | number | boolean | null;
  numericValue: number;
  meaning: string;
};

export type RiskFeatureSet = {
  vector: RiskFeatureVector;
  rows: RiskFeaturePreviewRow[];
};

const featureMeanings: Record<RiskFeatureName, string> = {
  entity_count: "Total structured mentions available for downstream models.",
  problem_count_present: "Present problems/symptoms/findings after assertion handling.",
  medication_count: "Medication mentions available as treatment context.",
  plan_count: "Plans, orders, referrals, and follow-up actions in the note.",
  functional_limitation_count: "Functional limitation mentions, mostly relevant to PT notes.",
  high_priority_count: "Extractor uncertainty flags that should be reviewed before model use.",
  pain_rating__last: "Most recent present pain rating; null means not extracted.",
  pain_rating__missing: "Preserves extraction absence separately from a clinical denial.",
  heart_rate__mean: "Mean extracted HR across present mentions in the note.",
  heart_rate__missing: "Indicates whether HR was unavailable to the model.",
  bp_systolic__last: "Last extracted systolic BP value.",
  bp_diastolic__last: "Last extracted diastolic BP value.",
  bp_missing: "Indicates whether BP was unavailable to the model.",
  phq9__max: "Highest PHQ-9 value in the current note.",
  phq9__missing: "Indicates whether PHQ-9 was unavailable to the model.",
  gad7__max: "Highest GAD-7 value in the current note.",
  si__present: "Suicidal ideation documented as present or possible.",
  si__explicitly_negated: "Distinguishes documented denial from missing SI documentation."
};

export function buildRiskFeatureSet(entities: ClinicalEntity[]): RiskFeatureSet {
  const painValues = entities
    .filter((entity) => entity.canonicalName === "pain rating" && entity.attributes?.assertion !== "absent")
    .map(parsePainSeverity)
    .filter((value): value is number => value !== null);
  const phq9Values = numericValues(entities, "Patient Health Questionnaire-9");
  const gad7Values = numericValues(entities, "Generalized Anxiety Disorder-7");
  const heartRateValues = numericValues(entities, "heart rate");
  const bloodPressure = [...entities].reverse().find((entity) => entity.canonicalName === "blood pressure");
  const suicidalIdeation = entities.filter((entity) => entity.canonicalName === "suicidal ideation");
  const presentEntities = entities.filter((entity) => entity.attributes?.assertion !== "absent");
  const systolic = parseNumeric(bloodPressure?.attributes?.systolic);
  const diastolic = parseNumeric(bloodPressure?.attributes?.diastolic);

  const displayValues: Record<RiskFeatureName, string | number | boolean | null> = {
    entity_count: entities.length,
    problem_count_present: presentEntities.filter((entity) => ["problem", "symptom", "finding", "risk"].includes(entity.type)).length,
    medication_count: presentEntities.filter((entity) => entity.type === "medication").length,
    plan_count: presentEntities.filter((entity) => ["plan", "referral", "procedure", "imaging"].includes(entity.type)).length,
    functional_limitation_count: presentEntities.filter((entity) => entity.type === "functional-limitation").length,
    high_priority_count: entities.filter((entity) => entity.uncertainty?.reviewPriority === "high").length,
    pain_rating__last: lastValue(painValues),
    pain_rating__missing: painValues.length === 0,
    heart_rate__mean: meanValue(heartRateValues),
    heart_rate__missing: heartRateValues.length === 0,
    bp_systolic__last: systolic,
    bp_diastolic__last: diastolic,
    bp_missing: systolic === null || diastolic === null,
    phq9__max: maxValue(phq9Values),
    phq9__missing: phq9Values.length === 0,
    gad7__max: maxValue(gad7Values),
    si__present: suicidalIdeation.some((entity) => entity.attributes?.assertion !== "absent"),
    si__explicitly_negated: suicidalIdeation.some((entity) => entity.attributes?.assertion === "absent")
  };

  const vector = RISK_FEATURE_NAMES.reduce<RiskFeatureVector>((features, feature) => {
    features[feature] = toNumericFeatureValue(displayValues[feature]);
    return features;
  }, emptyRiskFeatureVector());

  return {
    vector,
    rows: RISK_FEATURE_NAMES.map((feature) => ({
      feature,
      value: displayValues[feature],
      numericValue: vector[feature],
      meaning: featureMeanings[feature]
    }))
  };
}

export function emptyRiskFeatureVector(): RiskFeatureVector {
  return Object.fromEntries(RISK_FEATURE_NAMES.map((feature) => [feature, 0])) as RiskFeatureVector;
}

function numericValues(entities: ClinicalEntity[], canonicalName: string) {
  return entities
    .filter((entity) => entity.canonicalName === canonicalName && entity.attributes?.assertion !== "absent")
    .map((entity) => parseNumeric(entity.attributes?.value))
    .filter((value): value is number => value !== null);
}

function parsePainSeverity(entity: ClinicalEntity) {
  const severity = parseNumeric(entity.attributes?.severity);
  if (severity !== null) return severity;
  const value = entity.attributes?.value;
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)\/10$/);
  return match ? parseNumeric(match[1]) : parseNumeric(value);
}

function toNumericFeatureValue(value: string | number | boolean | null) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = parseNumeric(value ?? undefined);
  return parsed ?? 0;
}

function parseNumeric(value?: string | number) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lastValue(values: number[]) {
  return values.length ? values[values.length - 1] : null;
}

function maxValue(values: number[]) {
  return values.length ? Math.max(...values) : null;
}

function meanValue(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}
