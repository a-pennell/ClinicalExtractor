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
  confidence: "high" | "medium" | "low";
};

const ashaSource = {
  name: "ASHA Common Medical Abbreviations",
  url: "https://www.asha.org/practice-portal/professional-issues/documentation-in-health-care/common-medical-abbreviations/"
};

export const abbreviationRegistry: AbbreviationRegistryEntry[] = [
  direct("BP", "blood pressure", "blood pressure", "vital", ["primary-care", "physical-therapy", "mixed"]),
  direct("HR", "heart rate", "heart rate", "vital", ["primary-care", "physical-therapy", "mixed"]),
  direct("CBC", "complete blood count", "complete blood count", "lab", ["primary-care", "mixed"]),
  direct("CXR", "chest X-ray", "chest x-ray", "imaging", ["primary-care", "mixed"]),
  direct("HEP", "home exercise program", "home exercise program", "exercise", ["physical-therapy", "mixed"]),
  direct("MBSS", "modified barium swallow study", "modified barium swallow study", "imaging", ["physical-therapy", "mixed"]),
  direct("VFSS", "videofluoroscopic swallowing study", "videofluoroscopic swallowing study", "imaging", ["physical-therapy", "mixed"]),
  direct("SLP", "speech-language pathologist", "speech-language pathology", "referral", ["physical-therapy", "mixed"]),
  direct("ST", "speech therapy", "speech therapy", "referral", ["physical-therapy", "mixed"], false),
  direct("AAC", "augmentative and alternative communication", "augmentative and alternative communication", "functional-limitation", ["mixed"]),
  direct("ADL", "activities of daily living", "activities of daily living", "functional-limitation", ["physical-therapy", "mixed"]),
  ambiguous("PT", [
    { meaning: "patient", specialties: ["primary-care", "mental-health", "physical-therapy", "mixed"], contextHints: ["reports", "endorses", "denies"] },
    { meaning: "physical therapy", canonicalName: "physical therapy", entityType: "referral", specialties: ["physical-therapy", "mixed"], contextHints: ["referral", "HEP", "ROM", "therapy"] }
  ]),
  ambiguous("CP", [
    { meaning: "chest pain", canonicalName: "chest pain", entityType: "symptom", specialties: ["primary-care", "mixed"], contextHints: ["SOB", "cardiac", "denies", "BP"] },
    { meaning: "cerebral palsy", canonicalName: "cerebral palsy", entityType: "problem", specialties: ["primary-care", "physical-therapy", "mixed"], contextHints: ["developmental", "spasticity", "pediatric"] }
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
    if (!containsAbbreviation(text, entry.abbreviation)) return [];
    const chosen = chooseExpansion(text, entry, context);
    return [
      {
        abbreviation: entry.abbreviation,
        possibleMeanings: entry.expansions.map((expansion) => expansion.meaning),
        chosenMeaning: chosen?.meaning,
        canonicalName: chosen?.canonicalName,
        entityType: chosen?.entityType,
        source: entry.source.name,
        reason: chosen
          ? `Resolved from ${entry.source.name} using ${chosen.contextHints.join(", ")} context.`
          : `Ambiguous abbreviation from ${entry.source.name}; no strong context rule matched.`,
        confidence: chosen && !entry.ambiguous ? "high" : chosen ? "medium" : "low"
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

function chooseExpansion(text: string, entry: AbbreviationRegistryEntry, context: DetectedClinicalContext) {
  if (!entry.ambiguous) return entry.expansions[0];
  const normalizedText = text.toLowerCase();
  const scoredExpansions = entry.expansions
    .map((expansion) => ({
      expansion,
      score: expansion.contextHints.reduce(
        (score, hint) => score + (normalizedText.includes(hint.toLowerCase()) ? 1 : 0),
        0
      )
    }))
    .sort((a, b) => b.score - a.score);
  const bestScored = scoredExpansions[0];

  return (
    (bestScored?.score ? bestScored.expansion : undefined) ??
    entry.expansions.find((expansion) => expansion.specialties.includes(context.primarySpecialty)) ??
    undefined
  );
}

function containsAbbreviation(text: string, abbreviation: string) {
  const escaped = abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i").test(text);
}
