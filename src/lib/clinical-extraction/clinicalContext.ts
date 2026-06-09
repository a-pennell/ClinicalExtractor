import { resolveAbbreviations } from "./abbreviationRegistry";
import { detectClinicalSections } from "./sectionParser";
import type { DetectedClinicalContext, Specialty } from "./types";

type ContextSignal = {
  regex: RegExp;
  specialty: Specialty;
  label: string;
  weight: number;
};

const specialtyOrder: Specialty[] = ["primary-care", "mental-health", "physical-therapy", "mixed"];
const allSpecialties: Specialty[] = ["mixed", "primary-care", "mental-health", "physical-therapy"];

const lexicalSignals: ContextSignal[] = [
  { regex: /\b(?:HTN|T2DM|DM|HLD|A1c|CBC|CMP|BMP|LDL|HDL|BP|HR|SpO2|COPD|CAD|CHF|CKD|OSA)\b/i, specialty: "primary-care", label: "primary care abbreviations/labs/vitals", weight: 2 },
  { regex: /\b(?:lisinopril|metformin|atorvastatin|amlodipine|losartan|levothyroxine|albuterol)\b/i, specialty: "primary-care", label: "primary care medication vocabulary", weight: 1 },
  { regex: /\b(?:PHQ-?9|GAD-?7|SI|HI|AVH|MDD|PTSD|CBT|DBT|safety plan|anhedonia|low mood|panic|hypomania)\b/i, specialty: "mental-health", label: "behavioral health risk/screening vocabulary", weight: 2 },
  { regex: /\b(?:sertraline|fluoxetine|escitalopram|bupropion|duloxetine)\b/i, specialty: "mental-health", label: "behavioral health medication vocabulary", weight: 1 },
  { regex: /\b(?:ROM|AROM|PROM|HEP|MMT|TUG|5xSTS|SLR|Hawkins|Neer|McMurray|Lachman|FABER|WBAT|NWB|RLE|LLE|RUE|LUE)\b/i, specialty: "physical-therapy", label: "physical therapy measurement/exercise vocabulary", weight: 2 },
  { regex: /\b(?:gait|balance|overhead reach|stairs|manual muscle|range of motion|home exercise)\b/i, specialty: "physical-therapy", label: "physical therapy functional vocabulary", weight: 1 },
  { regex: /\b(?:SLP|ST|AAC|MBSS|VFSS|dysphagia|aphasia|dysarthria|swallow|aspiration|thickened liquids)\b/i, specialty: "physical-therapy", label: "speech-language pathology and swallowing vocabulary", weight: 2 }
];

export function detectClinicalContext(text: string): DetectedClinicalContext {
  const specialtyScores = emptyScores();
  const sectionSignals = detectSectionSignals(text, specialtyScores);
  const detectedLexicalSignals = detectLexicalSignals(text, specialtyScores);
  const primarySpecialty = choosePrimarySpecialty(specialtyScores);
  const abbreviationResolutions = resolveAbbreviations(text, {
    primarySpecialty,
    activeSpecialties: [],
    specialtyScores,
    noteType: "unknown",
    sectionSignals,
    lexicalSignals: detectedLexicalSignals,
    ambiguityWarnings: []
  });
  const activeSpecialties = chooseActiveSpecialties(specialtyScores, abbreviationResolutions);

  return {
    primarySpecialty,
    activeSpecialties,
    specialtyScores,
    noteType: detectNoteType(text),
    sectionSignals,
    lexicalSignals: detectedLexicalSignals,
    ambiguityWarnings: abbreviationResolutions
      .filter((resolution) => resolution.possibleMeanings.length > 1)
      .map((resolution) => ({
        abbreviation: resolution.abbreviation,
        possibleMeanings: resolution.possibleMeanings,
        chosenMeaning: resolution.chosenMeaning,
        reason: resolution.reason,
        source: resolution.source,
        evidence: resolution.evidence,
        mentionCount: resolution.mentionCount
      }))
  };
}

export function resolveExtractionSpecialties(options: { specialty?: Specialty; mode?: "auto" | "override" }, context: DetectedClinicalContext) {
  if (options.mode !== "auto" && options.specialty === "mixed") return allSpecialties;
  if (options.mode !== "auto" && options.specialty) return [options.specialty];
  return context.activeSpecialties;
}

function emptyScores(): Record<Specialty, number> {
  return {
    "primary-care": 0,
    "mental-health": 0,
    "physical-therapy": 0,
    mixed: 0
  };
}

function detectSectionSignals(text: string, scores: Record<Specialty, number>) {
  const sections = detectClinicalSections(text);
  const signals: string[] = [];

  sections.forEach((section) => {
    if (["medications", "allergies", "past-medical-history", "family-history"].includes(section.normalizedName)) {
      scores["primary-care"] += 1;
      signals.push(section.title);
    }
    if (["subjective", "objective"].includes(section.normalizedName) && /\b(ROM|AROM|PROM|HEP|gait|balance|pain)\b/i.test(text)) {
      scores["physical-therapy"] += 1;
      signals.push(section.title);
    }
    if (["assessment", "plan", "assessment-plan"].includes(section.normalizedName) && /\b(PHQ|GAD|SI|HI|CBT|DBT|mood|anxiety)\b/i.test(text)) {
      scores["mental-health"] += 1;
      signals.push(section.title);
    }
  });

  return Array.from(new Set(signals));
}

function detectLexicalSignals(text: string, scores: Record<Specialty, number>) {
  return lexicalSignals.flatMap((signal) => {
    if (!signal.regex.test(text)) return [];
    scores[signal.specialty] += signal.weight;
    return [signal.label];
  });
}

function choosePrimarySpecialty(scores: Record<Specialty, number>): Specialty {
  const ranked = specialtyOrder
    .filter((specialty) => specialty !== "mixed")
    .sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0];
  if (!top || scores[top] === 0) return "mixed";

  const second = ranked[1];
  if (second && scores[second] > 0 && scores[top] - scores[second] <= 1) return "mixed";
  return top;
}

function chooseActiveSpecialties(
  scores: Record<Specialty, number>,
  abbreviationResolutions: ReturnType<typeof resolveAbbreviations> = []
): Specialty[] {
  abbreviationResolutions.forEach((resolution) => {
    const registryEntrySpecialties = resolution.canonicalName ? specialtyHintsByCanonicalName[resolution.canonicalName] : undefined;
    registryEntrySpecialties?.forEach((specialty) => {
      scores[specialty] += 1;
    });
  });
  const active = specialtyOrder.filter((specialty) => specialty !== "mixed" && scores[specialty] > 0);
  return ["mixed", ...active] as Specialty[];
}

function detectNoteType(text: string): DetectedClinicalContext["noteType"] {
  if (/\b(subjective|objective|assessment|plan)\s*:/i.test(text)) return "soap";
  if (/\b(eval|evaluation|initial evaluation)\b/i.test(text)) return "eval";
  if (/\b(progress note|daily note|follow[- ]?up)\b/i.test(text)) return "progress-note";
  if (/\bplan\s*:/i.test(text)) return "plan";
  return "unknown";
}

const specialtyHintsByCanonicalName: Partial<Record<string, Specialty[]>> = {
  "physical therapy": ["physical-therapy"],
  "speech therapy": ["physical-therapy"],
  "speech-language pathology": ["physical-therapy"],
  "range of motion": ["physical-therapy"],
  "suicidal ideation": ["mental-health"],
  "chest pain": ["primary-care"],
  "cerebral palsy": ["primary-care", "physical-therapy"],
  "occupational therapy": ["physical-therapy"],
  "cancer": ["primary-care"],
  "cardiac arrest": ["primary-care"]
};
