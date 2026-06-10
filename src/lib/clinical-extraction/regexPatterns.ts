import type { ClinicalEntity, Segment, Specialty } from "./types";

export type RegexDetection = Omit<ClinicalEntity, "id">;

type PatternFactory = {
  type: ClinicalEntity["type"];
  canonicalName: string;
  displayName: string;
  specialties: Specialty[];
  regex: RegExp;
  buildCanonicalName?: (match: RegExpExecArray) => string;
  buildDisplayName?: (match: RegExpExecArray) => string;
  buildAttributes: (match: RegExpExecArray) => NonNullable<ClinicalEntity["attributes"]>;
  explanation: string;
};

const factories: PatternFactory[] = [
  {
    type: "score",
    canonicalName: "Patient Health Questionnaire-9",
    displayName: "PHQ-9",
    specialties: ["mental-health", "mixed"],
    regex: /\bPHQ-?9\s*(?:=|:)?\s*(\d{1,2})\b/gi,
    buildAttributes: (match) => ({ value: match[1], scale: "PHQ-9", normalizedTerm: "Patient Health Questionnaire-9" }),
    explanation: "Matched PHQ-9 score pattern."
  },
  {
    type: "score",
    canonicalName: "Generalized Anxiety Disorder-7",
    displayName: "GAD-7",
    specialties: ["mental-health", "mixed"],
    regex: /\bGAD-?7\s*(?:=|:)?\s*(\d{1,2})\b/gi,
    buildAttributes: (match) => ({ value: match[1], scale: "GAD-7", normalizedTerm: "Generalized Anxiety Disorder-7" }),
    explanation: "Matched GAD-7 score pattern."
  },
  {
    type: "score",
    canonicalName: "Alcohol Use Disorders Identification Test-Consumption",
    displayName: "AUDIT-C",
    specialties: ["primary-care", "mental-health", "mixed"],
    regex: /\bAUDIT-?C\s*(?:=|:)?\s*(\d{1,2})\b/gi,
    buildAttributes: (match) => ({
      value: match[1],
      scale: "AUDIT-C",
      normalizedTerm: "Alcohol Use Disorders Identification Test-Consumption"
    }),
    explanation: "Matched AUDIT-C score pattern."
  },
  {
    type: "score",
    canonicalName: "Columbia Suicide Severity Rating Scale",
    displayName: "C-SSRS",
    specialties: ["mental-health", "mixed"],
    regex: /\bC-?SSRS\s*(?:=|:)?\s*(\d{1,2})\b/gi,
    buildAttributes: (match) => ({
      value: match[1],
      scale: "C-SSRS",
      normalizedTerm: "Columbia Suicide Severity Rating Scale"
    }),
    explanation: "Matched C-SSRS score pattern."
  },
  {
    type: "lab",
    canonicalName: "hemoglobin A1c",
    displayName: "A1c",
    specialties: ["primary-care", "mixed"],
    regex: /\bA1c\s*(?:=|:)?\s*(\d+(?:\.\d+)?)\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "%", normalizedTerm: "hemoglobin A1c" }),
    explanation: "Matched A1c lab value pattern."
  },
  {
    type: "lab",
    canonicalName: "lab value",
    displayName: "Lab value",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex:
      /\b(Hgb|Hb|WBC|Plt|platelets|TSH|Cr|creatinine|eGFR|LDL|HDL|TG|triglycerides|total cholesterol|TC)\s*(?:=|:)?\s*(\d+(?:\.\d+)?)\s*(g\/dL|k\/uL|x10\^3\/uL|mg\/dL|mL\/min(?:\/1\.73m2)?|uIU\/mL)?\b/gi,
    buildCanonicalName: (match) => normalizeLabName(match[1]),
    buildDisplayName: (match) => titleCase(normalizeLabName(match[1])),
    buildAttributes: (match) => ({
      value: match[2],
      unit: normalizeLabUnit(match[1], match[3]),
      normalizedTerm: normalizeLabName(match[1])
    }),
    explanation: "Matched common lab value pattern."
  },
  {
    type: "vital",
    canonicalName: "body mass index",
    displayName: "BMI",
    specialties: ["primary-care", "mixed"],
    regex: /\bBMI\s*(?:=|:)?\s*(\d+(?:\.\d+)?)\b/gi,
    buildAttributes: (match) => ({ value: match[1], normalizedTerm: "body mass index" }),
    explanation: "Matched BMI vital pattern."
  },
  {
    type: "vital",
    canonicalName: "blood pressure",
    displayName: "Blood pressure",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:BP|blood pressure)\s*(?:=|:)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/gi,
    buildAttributes: (match) => ({
      value: `${match[1]}/${match[2]}`,
      unit: "mmHg",
      systolic: match[1],
      diastolic: match[2],
      normalizedTerm: "blood pressure"
    }),
    explanation: "Matched blood pressure vital sign pattern."
  },
  {
    type: "vital",
    canonicalName: "heart rate",
    displayName: "Heart rate",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:HR|heart rate|pulse)\s*(?:=|:)?\s*(\d{2,3})\s*(?:bpm|beats\/min)?\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "beats/min", normalizedTerm: "heart rate" }),
    explanation: "Matched heart rate vital sign pattern."
  },
  {
    type: "vital",
    canonicalName: "respiratory rate",
    displayName: "Respiratory rate",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:RR|respiratory rate|resp rate)\s*(?:=|:)?\s*(\d{1,3})\s*(?:\/min|breaths\/min)?\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "breaths/min", normalizedTerm: "respiratory rate" }),
    explanation: "Matched respiratory rate vital sign pattern."
  },
  {
    type: "vital",
    canonicalName: "oxygen saturation",
    displayName: "Oxygen saturation",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:SpO2|O2\s*sat|oxygen sat(?:uration)?|pulse ox)\s*(?:=|:)?\s*(\d{2,3})\s*%?\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "%", normalizedTerm: "oxygen saturation" }),
    explanation: "Matched oxygen saturation vital sign pattern."
  },
  {
    type: "vital",
    canonicalName: "body temperature",
    displayName: "Temperature",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:temp(?:erature)?|T)\s*(?:=|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?\s*(F|C|fahrenheit|celsius))?\b/gi,
    buildAttributes: (match) => {
      const unit = normalizeTemperatureUnit(match[2]);
      return { value: match[1], unit, normalizedTerm: "body temperature" };
    },
    explanation: "Matched body temperature vital sign pattern."
  },
  {
    type: "vital",
    canonicalName: "body weight",
    displayName: "Weight",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:wt|weight)\s*(?:=|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(kg|kgs|lb|lbs|pounds?)?\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: normalizeWeightUnit(match[2]), normalizedTerm: "body weight" }),
    explanation: "Matched body weight vital sign pattern."
  },
  {
    type: "severity",
    canonicalName: "pain rating",
    displayName: "Pain rating",
    specialties: ["physical-therapy", "primary-care", "mixed"],
    regex: /\bpain\s*(?:=|:)?\s*(\d{1,2})\/10\b/gi,
    buildAttributes: (match) => ({ value: `${match[1]}/10`, scale: "numeric pain rating", severity: match[1] }),
    explanation: "Matched numeric pain rating."
  },
  {
    type: "finding",
    canonicalName: "range of motion measurement",
    displayName: "ROM measurement",
    specialties: ["physical-therapy", "mixed"],
    regex: /\b(?:AROM|PROM|ROM)?\s*(flex|abd|abduction|flexion|ER|IR)\s*(\d{1,3})\b/gi,
    buildAttributes: (match) => ({ value: match[2], unit: "degrees", bodySite: match[1], normalizedTerm: "range of motion" }),
    explanation: "Matched range-of-motion measurement."
  },
  {
    type: "finding",
    canonicalName: "manual muscle test",
    displayName: "Strength grade",
    specialties: ["physical-therapy"],
    regex: /\b(ER|IR|flex|abd|ext)\s*(\d[+-]?\/5)\b/gi,
    buildAttributes: (match) => ({ value: match[2], scale: "MMT", bodySite: match[1], normalizedTerm: "manual muscle testing" }),
    explanation: "Matched manual muscle testing grade."
  },
  {
    type: "functional-limitation",
    canonicalName: "Timed Up and Go",
    displayName: "TUG",
    specialties: ["physical-therapy", "mixed"],
    regex: /\b(?:TUG|Timed Up and Go)\s*(?:=|:)?\s*(\d+(?:\.\d+)?)\s*(?:sec|secs|seconds?)\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "seconds", scale: "TUG", normalizedTerm: "Timed Up and Go" }),
    explanation: "Matched Timed Up and Go value pattern."
  },
  {
    type: "functional-limitation",
    canonicalName: "five times sit to stand",
    displayName: "5xSTS",
    specialties: ["physical-therapy", "mixed"],
    regex: /\b(?:5xSTS|five times sit to stand)\s*(?:=|:)?\s*(\d+(?:\.\d+)?)\s*(?:sec|secs|seconds?)\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: "seconds", scale: "5xSTS", normalizedTerm: "five times sit to stand" }),
    explanation: "Matched five-times-sit-to-stand value pattern."
  },
  {
    type: "duration",
    canonicalName: "duration",
    displayName: "Duration",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:x|for)\s*(\d+)\s*(days?|wks?|weeks?|mos?|months?|years?|yrs?)\b/gi,
    buildAttributes: (match) => ({ value: match[1], unit: match[2], duration: `${match[1]} ${match[2]}` }),
    explanation: "Matched duration shorthand."
  },
  {
    type: "plan",
    canonicalName: "follow up",
    displayName: "Follow up",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:f\/u|follow[- ]?up)\s+(?:in\s+)?(\d+)\s*(days?|wks?|weeks?|mos?|months?|years?|yrs?)\b/gi,
    buildAttributes: (match) => ({
      value: `${match[1]} ${match[2]}`,
      duration: `${match[1]} ${match[2]}`,
      normalizedTerm: "follow up"
    }),
    explanation: "Matched follow-up plan interval."
  },
  {
    type: "plan",
    canonicalName: "treatment frequency",
    displayName: "Treatment frequency",
    specialties: ["physical-therapy"],
    regex: /\b(?:cont|continue)?\s*(\d+)x\/(wk|week|mo|month)\b/gi,
    buildAttributes: (match) => ({ value: `${match[1]}x/${match[2]}`, frequency: `${match[1]}x/${match[2]}` }),
    explanation: "Matched treatment frequency."
  },
  {
    type: "risk",
    canonicalName: "tobacco use",
    displayName: "Tobacco use",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex:
      /\b(?:(denies|no)\s+(?:tobacco|smoking)|(?:tobacco|smoking)\s*[:=]?\s*(never|none|denies|former|current|[\d.]+\s*(?:ppd|packs?\/day))|smokes\s+([\d.]+)\s*(?:ppd|packs?\/day))\b/gi,
    buildAttributes: (match) => {
      const value = match[2] ?? (match[3] ? `${match[3]} ppd` : undefined);
      return {
        value,
        assertion: isAbsentPhrase(match[1] ?? match[2]) ? "absent" : "present",
        normalizedTerm: "tobacco use"
      };
    },
    explanation: "Matched tobacco or smoking social-history pattern."
  },
  {
    type: "risk",
    canonicalName: "alcohol use",
    displayName: "Alcohol use",
    specialties: ["primary-care", "mental-health", "mixed"],
    regex:
      /\b(?:(denies|no)\s+(?:alcohol|EtOH)|(?:EtOH|alcohol)\s*[:=]?\s*(never|none|denies|social|rare|daily|weekly|[\d.]+\s*(?:drinks?|beers?|glasses)(?:\/(?:day|wk|week))?))\b/gi,
    buildAttributes: (match) => ({
      value: match[2],
      assertion: isAbsentPhrase(match[1] ?? match[2]) ? "absent" : "present",
      normalizedTerm: "alcohol use"
    }),
    explanation: "Matched alcohol social-history pattern."
  },
  {
    type: "risk",
    canonicalName: "substance use",
    displayName: "Substance use",
    specialties: ["primary-care", "mental-health", "mixed"],
    regex: /\b(?:uses?\s+)?(marijuana|cannabis|THC|cocaine|opioids?|methamphetamine)\s*(daily|weekly|occasionally|use)?\b/gi,
    buildDisplayName: (match) => `${titleCase(match[1])} use`,
    buildAttributes: (match) => ({
      substance: match[1].toLowerCase(),
      frequency: match[2]?.toLowerCase(),
      normalizedTerm: "substance use"
    }),
    explanation: "Matched substance-use social-history pattern."
  },
  {
    type: "risk",
    canonicalName: "family history",
    displayName: "Family history",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex:
      /\b(?:FHx|family history(?: of)?)\s*[:-]?\s*(?:(mother|father|sister|brother|parent|maternal grandmother|paternal grandmother|maternal grandfather|paternal grandfather)\s+(?:with|has|had)\s+)?(diabetes|DM|colon cancer|breast cancer|heart disease|CAD|depression|bipolar disorder)\b/gi,
    buildCanonicalName: (match) => `family history of ${normalizeFamilyCondition(match[2])}`,
    buildDisplayName: (match) => `Family history of ${normalizeFamilyCondition(match[2])}`,
    buildAttributes: (match) => ({
      assertion: "family-history",
      familyMember: match[1]?.toLowerCase(),
      normalizedTerm: `family history of ${normalizeFamilyCondition(match[2])}`
    }),
    explanation: "Matched family-history pattern."
  },
  {
    type: "risk",
    canonicalName: "family history",
    displayName: "Family history",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex:
      /\b(mother|father|sister|brother|parent|maternal grandmother|paternal grandmother|maternal grandfather|paternal grandfather)\s+(?:with|has|had)\s+(diabetes|DM|colon cancer|breast cancer|heart disease|CAD|depression|bipolar disorder)\b/gi,
    buildCanonicalName: (match) => `family history of ${normalizeFamilyCondition(match[2])}`,
    buildDisplayName: (match) => `Family history of ${normalizeFamilyCondition(match[2])}`,
    buildAttributes: (match) => ({
      assertion: "family-history",
      familyMember: match[1]?.toLowerCase(),
      normalizedTerm: `family history of ${normalizeFamilyCondition(match[2])}`
    }),
    explanation: "Matched family-member history pattern."
  },
  {
    type: "imaging",
    canonicalName: "imaging",
    displayName: "Imaging",
    specialties: ["primary-care", "physical-therapy", "mixed"],
    regex:
      /\b(?:(ordered|order|reviewed|obtained)\s+)?(CXR|chest x-?ray|x-?ray|XR|MRI|CT|ultrasound|US)\s*(?:of\s+)?([a-z][a-z\s-]{1,35})?/gi,
    buildCanonicalName: (match) => normalizeImagingName(match[2], match[3]),
    buildDisplayName: (match) => titleCase(normalizeImagingName(match[2], match[3])),
    buildAttributes: (match) => ({
      assertion: match[1]?.toLowerCase().startsWith("order") ? "ordered" : "present",
      modality: normalizeModality(match[2]),
      bodySite: cleanBodySite(match[3]),
      normalizedTerm: normalizeImagingName(match[2], match[3])
    }),
    explanation: "Matched imaging study pattern."
  },
  {
    type: "referral",
    canonicalName: "referral",
    displayName: "Referral",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:refer(?:ral)?(?:red)? to|referral to|consult)\s+(PT|physical therapy|psychiatry|psych|cardiology|ortho|orthopedics|neurology)\b/gi,
    buildCanonicalName: (match) => `referral to ${normalizeReferralTarget(match[1])}`,
    buildDisplayName: (match) => `Referral to ${normalizeReferralTarget(match[1])}`,
    buildAttributes: (match) => ({
      assertion: "planned",
      normalizedTerm: `referral to ${normalizeReferralTarget(match[1])}`
    }),
    explanation: "Matched referral pattern."
  },
  {
    type: "procedure",
    canonicalName: "procedure",
    displayName: "Procedure",
    specialties: ["primary-care", "physical-therapy", "mixed"],
    regex: /\b(colonoscopy|pap smear|joint injection|cortisone injection|steroid injection)\b/gi,
    buildCanonicalName: (match) => match[1].toLowerCase(),
    buildDisplayName: (match) => titleCase(match[1]),
    buildAttributes: (match) => ({ normalizedTerm: match[1].toLowerCase() }),
    explanation: "Matched procedure pattern."
  },
  {
    type: "finding",
    canonicalName: "gait abnormality",
    displayName: "Gait abnormality",
    specialties: ["physical-therapy", "mixed"],
    regex: /\b(antalgic gait|impaired gait|gait instability)\b/gi,
    buildAttributes: (match) => ({ normalizedTerm: match[1].toLowerCase() }),
    explanation: "Matched gait finding."
  },
  {
    type: "functional-limitation",
    canonicalName: "impaired balance",
    displayName: "Impaired balance",
    specialties: ["physical-therapy", "mixed"],
    regex: /\b(impaired balance|poor balance|balance deficits?)\b/gi,
    buildAttributes: (match) => ({ normalizedTerm: match[1].toLowerCase() }),
    explanation: "Matched balance limitation."
  },
  {
    type: "risk",
    canonicalName: "fall risk",
    displayName: "Fall risk",
    specialties: ["physical-therapy", "primary-care", "mixed"],
    regex: /\b(fall risk|falls? risk|history of falls?)\b/gi,
    buildAttributes: (match) => ({ normalizedTerm: match[1].toLowerCase() }),
    explanation: "Matched fall-risk pattern."
  },
  {
    type: "symptom",
    canonicalName: "panic attacks",
    displayName: "Panic attacks",
    specialties: ["mental-health", "primary-care", "mixed"],
    regex: /\b(panic attacks?|panic episodes?)\b/gi,
    buildAttributes: () => ({ normalizedTerm: "panic attacks" }),
    explanation: "Matched panic symptom pattern."
  },
  {
    type: "finding",
    canonicalName: "mania",
    displayName: "Mania",
    specialties: ["mental-health", "mixed"],
    regex: /\b(mania|manic symptoms?|hypomania|hypomanic symptoms?)\b/gi,
    buildAttributes: (match) => ({ normalizedTerm: match[1].toLowerCase() }),
    explanation: "Matched mania/hypomania finding pattern."
  },
  {
    type: "risk",
    canonicalName: "safety plan",
    displayName: "Safety plan",
    specialties: ["mental-health", "mixed"],
    regex: /\b(safety plan|crisis plan)\b/gi,
    buildAttributes: () => ({ assertion: "planned", normalizedTerm: "safety plan" }),
    explanation: "Matched safety-plan pattern."
  },
  {
    type: "medication",
    canonicalName: "medication",
    displayName: "Medication",
    specialties: ["primary-care", "mental-health", "mixed"],
    regex:
      /\b(lisinopril|sertraline|metformin|ibuprofen|acetaminophen|atorvastatin|amlodipine|losartan|levothyroxine|omeprazole|fluoxetine|escitalopram|bupropion|duloxetine|gabapentin)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|units?|tabs?|tablets?|caps?)\s*(?:(PO|oral|by mouth|IM|IV|SQ|SC|topical|SL)\s*)?(?:(daily|qday|qd|bid|tid|qid|qhs|qam|qpm|weekly|q\d+h|every\s+\d+\s+hours?|once daily|twice daily|three times daily)\s*)?(?:(PRN|as needed)\s*([a-z][a-z\s-]{1,40})?)?/gi,
    buildCanonicalName: (match) => match[1].toLowerCase(),
    buildDisplayName: (match) => titleCase(match[1]),
    buildAttributes: (match) => {
      const medication = match[1].toLowerCase();
      const dose = `${match[2]} ${normalizeDoseUnit(match[3])}`;
      const route = normalizeRoute(match[4]);
      const frequency = normalizeFrequency(match[5]);
      const prn = Boolean(match[6]);
      const indication = match[7]?.trim();

      return {
        dose,
        route,
        frequency,
        prn,
        indication,
        sig: buildSig(dose, route, frequency, prn, indication),
        normalizedTerm: medication
      };
    },
    explanation: "Matched medication dose and sig pattern."
  },
  {
    type: "medication",
    canonicalName: "medication",
    displayName: "Medication",
    specialties: ["primary-care", "mental-health", "mixed"],
    regex:
      /\b(albuterol)\s+(?:inhaler\s+)?(\d+(?:\.\d+)?)\s*(puffs?)\s*(?:(q\d+h|every\s+\d+\s+hours?)\s*)?(?:(PRN|as needed)\s*([a-z][a-z\s-]{1,40})?)?/gi,
    buildCanonicalName: (match) => match[1].toLowerCase(),
    buildDisplayName: (match) => titleCase(match[1]),
    buildAttributes: (match) => {
      const dose = `${match[2]} ${normalizeDoseUnit(match[3])}`;
      const frequency = normalizeFrequency(match[4]);
      const prn = Boolean(match[5]);
      const indication = match[6]?.trim();

      return {
        dose,
        route: "inhaled",
        frequency,
        prn,
        indication,
        sig: buildSig(dose, "inhaled", frequency, prn, indication),
        normalizedTerm: match[1].toLowerCase()
      };
    },
    explanation: "Matched inhaled medication sig pattern."
  },
  {
    type: "allergy",
    canonicalName: "no known drug allergies",
    displayName: "No known drug allergies",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex: /\b(?:NKDA|NKA|no known (?:drug )?allergies|denies (?:drug )?allergies)\b/gi,
    buildAttributes: () => ({
      assertion: "absent",
      substance: "drug allergies",
      normalizedTerm: "no known drug allergies"
    }),
    explanation: "Matched no-known-allergies shorthand."
  },
  {
    type: "allergy",
    canonicalName: "allergy",
    displayName: "Allergy",
    specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"],
    regex:
      /\b(?:allerg(?:y|ies)(?:\s+to)?|allergic\s+to)\s*[:-]?\s*(penicillin|pcn|sulfa|sulfonamides?|latex|peanuts?|shellfish|amoxicillin)\b(?:\s*(?:-|with|causes?|caused|reaction:?|rxn:?)\s*([a-z][a-z\s/-]{2,40}))?/gi,
    buildCanonicalName: (match) => `${normalizeSubstance(match[1])} allergy`,
    buildDisplayName: (match) => `${titleCase(normalizeSubstance(match[1]))} allergy`,
    buildAttributes: (match) => ({
      assertion: "present",
      substance: normalizeSubstance(match[1]),
      reaction: cleanReaction(match[2]),
      normalizedTerm: `${normalizeSubstance(match[1])} allergy`
    }),
    explanation: "Matched allergy substance and optional reaction."
  }
];

function normalizeTemperatureUnit(unit?: string) {
  if (!unit) return "degF";
  const normalized = unit.toLowerCase();
  if (normalized === "c" || normalized === "celsius") return "Cel";
  return "degF";
}

function normalizeWeightUnit(unit?: string) {
  if (!unit) return undefined;
  const normalized = unit.toLowerCase();
  if (normalized === "kg" || normalized === "kgs") return "kg";
  return "lb";
}

function normalizeDoseUnit(unit: string) {
  const normalized = unit.toLowerCase();
  if (normalized === "tablets") return "tablet";
  if (normalized === "tabs") return "tab";
  if (normalized === "caps") return "cap";
  if (normalized === "puffs") return "puff";
  if (normalized === "units") return "unit";
  return normalized;
}

function normalizeRoute(route?: string) {
  if (!route) return undefined;
  const normalized = route.toLowerCase();
  if (normalized === "by mouth" || normalized === "oral") return "PO";
  if (normalized === "sc") return "SQ";
  return normalized.toUpperCase();
}

function normalizeFrequency(frequency?: string) {
  if (!frequency) return undefined;
  const normalized = frequency.toLowerCase().replace(/\s+/g, " ").trim();
  const frequencyMap: Record<string, string> = {
    qday: "daily",
    qd: "daily",
    qam: "every morning",
    qpm: "every evening",
    qhs: "at bedtime",
    bid: "twice daily",
    tid: "three times daily",
    qid: "four times daily"
  };
  return frequencyMap[normalized] ?? normalized;
}

function buildSig(dose: string, route?: string, frequency?: string, prn?: boolean, indication?: string) {
  return [dose, route, frequency, prn ? "as needed" : undefined, indication ? `for ${indication}` : undefined]
    .filter(Boolean)
    .join(" ");
}

function normalizeSubstance(substance: string) {
  const normalized = substance.toLowerCase();
  if (normalized === "pcn") return "penicillin";
  if (normalized === "sulfonamide" || normalized === "sulfonamides") return "sulfa";
  if (normalized === "peanuts") return "peanut";
  return normalized;
}

function cleanReaction(reaction?: string) {
  return reaction?.replace(/[.。]+$/, "").trim();
}

function normalizeLabName(name: string) {
  const normalized = name.toLowerCase();
  const labMap: Record<string, string> = {
    hgb: "hemoglobin",
    hb: "hemoglobin",
    wbc: "white blood cell count",
    plt: "platelet count",
    platelets: "platelet count",
    tsh: "thyroid stimulating hormone",
    cr: "creatinine",
    creatinine: "creatinine",
    egfr: "estimated glomerular filtration rate",
    ldl: "low density lipoprotein cholesterol",
    hdl: "high density lipoprotein cholesterol",
    tg: "triglycerides",
    triglycerides: "triglycerides",
    "total cholesterol": "total cholesterol",
    tc: "total cholesterol"
  };
  return labMap[normalized] ?? normalized;
}

function normalizeLabUnit(name: string, unit?: string) {
  if (unit) return unit;
  const canonicalName = normalizeLabName(name);
  if (canonicalName === "hemoglobin") return "g/dL";
  if (canonicalName === "white blood cell count" || canonicalName === "platelet count") return "k/uL";
  if (canonicalName.includes("cholesterol") || canonicalName === "triglycerides" || canonicalName === "creatinine") {
    return "mg/dL";
  }
  if (canonicalName === "estimated glomerular filtration rate") return "mL/min/1.73m2";
  if (canonicalName === "thyroid stimulating hormone") return "uIU/mL";
  return undefined;
}

function isAbsentPhrase(value?: string) {
  return Boolean(value && /^(denies|no|none|never)$/i.test(value.trim()));
}

function normalizeFamilyCondition(condition: string) {
  const normalized = condition.toLowerCase();
  if (normalized === "dm" || normalized === "diabetes") return "diabetes mellitus";
  if (normalized === "cad") return "heart disease";
  return normalized;
}

function normalizeModality(modality: string) {
  const normalized = modality.toLowerCase();
  if (normalized === "cxr" || normalized === "chest x-ray") return "x-ray";
  if (normalized === "xr" || normalized === "x-ray") return "x-ray";
  if (normalized === "us") return "ultrasound";
  return normalized.toUpperCase();
}

function cleanBodySite(bodySite?: string) {
  return bodySite?.replace(/[.。]+$/, "").trim().toLowerCase();
}

function normalizeImagingName(modality: string, bodySite?: string) {
  const normalizedModality = normalizeModality(modality);
  const site = cleanBodySite(bodySite) ?? (modality.toLowerCase() === "cxr" ? "chest" : undefined);
  return [site, normalizedModality].filter(Boolean).join(" ");
}

function normalizeReferralTarget(target: string) {
  const normalized = target.toLowerCase();
  const targetMap: Record<string, string> = {
    pt: "physical therapy",
    psych: "psychiatry",
    ortho: "orthopedics"
  };
  return targetMap[normalized] ?? normalized;
}

const clinicalAcronyms = new Set([
  "A1C",
  "AROM",
  "AVH",
  "BMI",
  "BP",
  "CBC",
  "CP",
  "CT",
  "CXR",
  "ER",
  "FHX",
  "GAD",
  "GAD-7",
  "HB",
  "HDL",
  "HEP",
  "HGB",
  "HR",
  "IR",
  "LDL",
  "MRI",
  "MMT",
  "PHQ-9",
  "PROM",
  "PT",
  "RR",
  "SI",
  "SOB",
  "SPO2",
  "TG",
  "TSH",
  "US",
  "WBC"
]);

function titleCase(value: string) {
  return value
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part.trim() || part === "-") return part;

      const acronym = part.toUpperCase();
      if (clinicalAcronyms.has(acronym)) return acronym;

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

export function detectRegexEntities(text: string, segments: Segment[], specialties: Specialty | Specialty[]): RegexDetection[] {
  const activeSpecialties = Array.isArray(specialties) ? specialties : [specialties];
  return factories.flatMap((factory) => {
    if (!factory.specialties.includes("mixed") && !activeSpecialties.some((specialty) => factory.specialties.includes(specialty))) {
      return [];
    }

    const detections: RegexDetection[] = [];
    const regex = new RegExp(factory.regex.source, factory.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
      const sentence = segments.find((segment) => match && match.index >= segment.start && match.index < segment.end);
      detections.push({
        canonicalName: factory.buildCanonicalName?.(match) ?? factory.canonicalName,
        displayName: factory.buildDisplayName?.(match) ?? factory.displayName,
        type: factory.type,
        specialties: factory.specialties,
        mentions: [
          {
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            sentence: sentence?.text,
            section: sentence?.section
          }
        ],
        attributes: factory.buildAttributes(match),
        confidence: "high",
        explanation: factory.explanation
      });
    }

    return detections;
  });
}
