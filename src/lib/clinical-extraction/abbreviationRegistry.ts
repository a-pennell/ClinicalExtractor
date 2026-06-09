import type { ClinicalEntityType, DetectedClinicalContext, Specialty } from "./types";

export type AbbreviationRegistryEntry = {
  abbreviation: string;
  expansions: {
    meaning: string;
    canonicalName?: string;
    entityType?: ClinicalEntityType;
    specialties: Specialty[];
    contextHints: string[];
  }[];
  source: {
    name: string;
    url: string;
  };
  ambiguous: boolean;
  safeForDirectExtraction: boolean;
};

export type AbbreviationResolution = {
  abbreviation: string;
  possibleMeanings: string[];
  chosenMeaning?: string;
  canonicalName?: string;
  entityType?: ClinicalEntityType;
  source: string;
  reason: string;
  evidence?: string[];
  mentionCount: number;
  confidence: "high" | "medium" | "low";
};

const ashaSource = {
  name: "ASHA Common Medical Abbreviations",
  url: "https://www.asha.org/practice-portal/professional-issues/documentation-in-health-care/common-medical-abbreviations/"
};

export const abbreviationRegistry: AbbreviationRegistryEntry[] = [
  direct("AAROM", "active assistive range of motion", "active assistive range of motion", "finding", ["physical-therapy", "mixed"]),
  direct("BP", "blood pressure", "blood pressure", "vital", ["primary-care", "physical-therapy", "mixed"]),
  direct("VS", "vital signs", "vital signs", "vital", ["primary-care", "physical-therapy", "mixed"]),
  direct("TPR", "temperature, pulse, respiration", "vital signs", "vital", ["primary-care", "mixed"]),
  direct("HR", "heart rate", "heart rate", "vital", ["primary-care", "physical-therapy", "mixed"]),
  direct("RR", "respiratory rate", "respiratory rate", "vital", ["primary-care", "mixed"]),
  direct("CBC", "complete blood count", "complete blood count", "lab", ["primary-care", "mixed"]),
  direct("ABG", "arterial blood gas", "arterial blood gas", "lab", ["primary-care", "mixed"]),
  direct("UA", "urinalysis", "urinalysis", "lab", ["primary-care", "mixed"]),
  direct("CXR", "chest X-ray", "chest x-ray", "imaging", ["primary-care", "mixed"]),
  direct("CT", "computerized tomography", "computed tomography", "imaging", ["primary-care", "mixed"]),
  direct("MRI", "magnetic resonance imaging", "magnetic resonance imaging", "imaging", ["primary-care", "physical-therapy", "mixed"]),
  direct("u/s", "ultrasound", "ultrasound", "imaging", ["primary-care", "mixed"]),
  direct("HEP", "home exercise program", "home exercise program", "exercise", ["physical-therapy", "mixed"]),
  direct("ADL", "activities of daily living", "activities of daily living", "functional-limitation", ["physical-therapy", "mixed"]),
  direct("FWB", "full weight bearing", "full weight bearing", "functional-limitation", ["physical-therapy", "mixed"]),
  direct("NWB", "non-weight bearing", "non-weight bearing", "functional-limitation", ["physical-therapy", "mixed"]),
  direct("WBAT", "weight bearing as tolerated", "weight bearing as tolerated", "functional-limitation", ["physical-therapy", "mixed"]),
  direct("RLE", "right lower extremity", "right lower extremity", "body-site", ["physical-therapy", "mixed"]),
  direct("LLE", "left lower extremity", "left lower extremity", "body-site", ["physical-therapy", "mixed"]),
  direct("RUE", "right upper extremity", "right upper extremity", "body-site", ["physical-therapy", "mixed"]),
  direct("LUE", "left upper extremity", "left upper extremity", "body-site", ["physical-therapy", "mixed"]),
  direct("MBSS", "modified barium swallow study", "modified barium swallow study", "imaging", ["physical-therapy", "mixed"]),
  direct("VFSS", "videofluoroscopic swallowing study", "videofluoroscopic swallowing study", "imaging", ["physical-therapy", "mixed"]),
  direct("SLP", "speech-language pathologist", "speech-language pathology", "referral", ["physical-therapy", "mixed"]),
  direct("ST", "speech therapy", "speech therapy", "referral", ["physical-therapy", "mixed"], false),
  direct("AAC", "augmentative and alternative communication", "augmentative and alternative communication", "functional-limitation", ["mixed"]),
  direct("ASL", "American Sign Language", "American Sign Language", "functional-limitation", ["mixed"]),
  direct("PMH", "past medical history", "past medical history", "other", ["primary-care", "mental-health", "physical-therapy", "mixed"], false),
  direct("FH", "family history", "family history", "other", ["primary-care", "mental-health", "mixed"], false),
  direct("SH", "social history", "social history", "other", ["primary-care", "mental-health", "mixed"], false),
  direct("NKA", "no known allergies", "no known allergies", "allergy", ["primary-care", "mixed"]),
  direct("NPO", "nothing by mouth", "nothing by mouth", "plan", ["primary-care", "mixed"]),
  direct("SOB", "shortness of breath", "shortness of breath", "symptom", ["primary-care", "mixed"]),
  direct("DOE", "dyspnea on exertion", "dyspnea on exertion", "symptom", ["primary-care", "mixed"]),
  direct("CAD", "coronary artery disease", "coronary artery disease", "problem", ["primary-care", "mixed"]),
  direct("CHF", "congestive heart failure", "congestive heart failure", "problem", ["primary-care", "mixed"]),
  direct("COPD", "chronic obstructive pulmonary disease", "chronic obstructive pulmonary disease", "problem", ["primary-care", "mixed"]),
  direct("CVA", "cerebrovascular accident", "cerebrovascular accident", "problem", ["primary-care", "physical-therapy", "mixed"]),
  direct("TBI", "traumatic brain injury", "traumatic brain injury", "problem", ["primary-care", "physical-therapy", "mixed"]),
  direct("SCI", "spinal cord injury", "spinal cord injury", "problem", ["primary-care", "physical-therapy", "mixed"]),
  direct("GERD", "gastroesophageal reflux disease", "gastroesophageal reflux disease", "problem", ["primary-care", "mixed"]),
  direct("URI", "upper respiratory infection", "upper respiratory infection", "problem", ["primary-care", "mixed"]),
  direct("UTI", "urinary tract infection", "urinary tract infection", "problem", ["primary-care", "mixed"]),
  direct("Dx", "diagnosis", "diagnosis", "other", ["primary-care", "mental-health", "physical-therapy", "mixed"], false),
  direct("Tx", "treatment", "treatment", "plan", ["primary-care", "mental-health", "physical-therapy", "mixed"], false),
  direct("Rx", "prescription", "prescription", "medication", ["primary-care", "mental-health", "mixed"], false),
  direct("s/p", "status post", "status post", "other", ["primary-care", "physical-therapy", "mixed"], false),
  direct("f/u", "follow-up", "follow up", "plan", ["primary-care", "mental-health", "physical-therapy", "mixed"]),
  direct("c/o", "complains of", "complains of", "other", ["primary-care", "mental-health", "physical-therapy", "mixed"], false),
  direct("w/o", "without", "without", "other", ["primary-care", "mental-health", "physical-therapy", "mixed"], false),
  direct("WNL", "within normal limits", "within normal limits", "finding", ["primary-care", "physical-therapy", "mixed"]),
  direct("WFL", "within functional limits", "within functional limits", "finding", ["physical-therapy", "mixed"]),
  ambiguous("PT", [
    { meaning: "patient", specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"], contextHints: ["reports", "endorses", "denies", "states", "presents"] },
    { meaning: "physical therapy", canonicalName: "physical therapy", entityType: "referral", specialties: ["physical-therapy", "mixed"], contextHints: ["referral", "HEP", "ROM", "therapy"] }
  ]),
  ambiguous("OT", [
    { meaning: "occupational therapy", canonicalName: "occupational therapy", entityType: "referral", specialties: ["physical-therapy", "mixed"], contextHints: ["referral", "ADL", "therapy", "splint"] },
    { meaning: "ear", specialties: ["primary-care", "mixed"], contextHints: ["ear", "otitis", "ENT"] }
  ]),
  ambiguous("CP", [
    { meaning: "chest pain", canonicalName: "chest pain", entityType: "symptom", specialties: ["primary-care", "mixed"], contextHints: ["SOB", "cardiac", "denies", "BP"] },
    { meaning: "cerebral palsy", canonicalName: "cerebral palsy", entityType: "problem", specialties: ["primary-care", "physical-therapy", "mixed"], contextHints: ["developmental", "spasticity", "pediatric"] }
  ]),
  ambiguous("CA", [
    { meaning: "cancer", canonicalName: "cancer", entityType: "problem", specialties: ["primary-care", "mixed"], contextHints: ["oncology", "carcinoma", "metastasis", "tumor"] },
    { meaning: "cardiac arrest", canonicalName: "cardiac arrest", entityType: "problem", specialties: ["primary-care", "mixed"], contextHints: ["resuscitation", "CPR", "arrest", "ROSC"] }
  ]),
  ambiguous("SI", [
    { meaning: "suicidal ideation", canonicalName: "suicidal ideation", entityType: "risk", specialties: ["mental-health", "mixed"], contextHints: ["HI", "PHQ-9", "risk", "denies"] },
    { meaning: "stroke index", specialties: ["primary-care", "mixed"], contextHints: ["cardiac", "hemodynamic"] }
  ]),
  ambiguous("ROM", [
    { meaning: "range of motion", canonicalName: "range of motion", entityType: "finding", specialties: ["physical-therapy", "mixed"], contextHints: ["AROM", "PROM", "flex", "HEP"] },
    { meaning: "rupture of membranes", specialties: ["primary-care", "mixed"], contextHints: ["OB", "pregnancy", "labor"] },
    { meaning: "right otitis media", specialties: ["primary-care", "mixed"], contextHints: ["ear", "otitis", "pediatric"] }
  ]),
  ambiguous("DC", [
    { meaning: "discharge", canonicalName: "discharge", entityType: "plan", specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"], contextHints: ["home", "hospital", "SNF"] },
    { meaning: "discontinue", canonicalName: "discontinue medication", entityType: "plan", specialties: ["primary-care", "mental-health", "mixed"], contextHints: ["medication", "stop", "hold"] }
  ]),
  ambiguous("d/c", [
    { meaning: "discontinue", canonicalName: "discontinue medication", entityType: "plan", specialties: ["primary-care", "mental-health", "mixed"], contextHints: ["medication", "stop", "hold"] },
    { meaning: "discharge", canonicalName: "discharge", entityType: "plan", specialties: ["primary-care", "physical-therapy", "mixed"], contextHints: ["home", "SNF", "hospital"] }
  ])
];

export function resolveAbbreviations(text: string, context: DetectedClinicalContext): AbbreviationResolution[] {
  return abbreviationRegistry.flatMap((entry) => {
    const matches = findAbbreviationMatches(text, entry.abbreviation);
    if (!matches.length) return [];
    const resolved = chooseExpansion(text, entry, context, matches);
    const chosen = resolved?.expansion;
    return [
      {
        abbreviation: entry.abbreviation,
        possibleMeanings: entry.expansions.map((expansion) => expansion.meaning),
        chosenMeaning: chosen?.meaning,
        canonicalName: chosen?.canonicalName,
        entityType: chosen?.entityType,
        source: entry.source.name,
        reason: chosen
          ? `Resolved from ${entry.source.name} using ${resolved.evidence.length ? resolved.evidence.join(", ") : "specialty"} context.`
          : `Ambiguous abbreviation from ${entry.source.name}; no strong context rule matched.`,
        evidence: resolved?.evidence,
        mentionCount: matches.length,
        confidence: chosen && !entry.ambiguous ? "high" : resolved?.confidence ?? "low"
      }
    ];
  });
}

function direct(
  abbreviation: string,
  meaning: string,
  canonicalName: string,
  entityType: ClinicalEntityType,
  specialties: Specialty[],
  safeForDirectExtraction = true
): AbbreviationRegistryEntry {
  return {
    abbreviation,
    expansions: [{ meaning, canonicalName, entityType, specialties, contextHints: [meaning] }],
    source: ashaSource,
    ambiguous: false,
    safeForDirectExtraction
  };
}

function ambiguous(abbreviation: string, expansions: AbbreviationRegistryEntry["expansions"]): AbbreviationRegistryEntry {
  return {
    abbreviation,
    expansions,
    source: ashaSource,
    ambiguous: true,
    safeForDirectExtraction: false
  };
}

function chooseExpansion(
  text: string,
  entry: AbbreviationRegistryEntry,
  context: DetectedClinicalContext,
  matches: { start: number; end: number }[]
) {
  if (!entry.ambiguous) {
    return { expansion: entry.expansions[0], evidence: entry.expansions[0].contextHints, confidence: "high" as const };
  }
  const normalizedText = text.toLowerCase();
  const windows = matches.map((match) => normalizedText.slice(Math.max(0, match.start - 90), Math.min(text.length, match.end + 90)));
  const scoredExpansions = entry.expansions
    .map((expansion) => {
      const evidence = expansion.contextHints.filter((hint) => {
        const normalizedHint = hint.toLowerCase();
        return windows.some((windowText) => windowText.includes(normalizedHint));
      });
      const documentEvidence = expansion.contextHints.filter((hint) => {
        const normalizedHint = hint.toLowerCase();
        return !evidence.includes(hint) && normalizedText.includes(normalizedHint);
      });
      const specialtyScore =
        expansion.specialties.includes(context.primarySpecialty) || context.activeSpecialties.some((specialty) => expansion.specialties.includes(specialty))
          ? 1
          : 0;

      return {
        expansion,
        evidence: evidence.concat(documentEvidence),
        score: evidence.length * 3 + documentEvidence.length + specialtyScore
      };
    })
    .sort((a, b) => b.score - a.score);
  const bestScored = scoredExpansions[0];
  const secondScored = scoredExpansions[1];
  const hasTie = bestScored && secondScored && bestScored.score === secondScored.score;
  if (hasTie && bestScored.score > 1) return undefined;
  if (bestScored?.score) {
    return {
      expansion: bestScored.expansion,
      evidence: bestScored.evidence,
      confidence: bestScored.evidence.length ? ("medium" as const) : ("low" as const)
    };
  }

  const specialtyFallback = entry.expansions.find((expansion) => expansion.specialties.includes(context.primarySpecialty));
  return specialtyFallback ? { expansion: specialtyFallback, evidence: [], confidence: "low" as const } : undefined;
}

function findAbbreviationMatches(text: string, abbreviation: string) {
  const escaped = abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "gi");
  const matches: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    matches.push({ start: match.index, end: match.index + match[0].length });
  }
  return matches;
}
