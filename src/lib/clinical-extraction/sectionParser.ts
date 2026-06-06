import type { ClinicalSection, ClinicalSectionName } from "./types";

const sectionHeadingPattern =
  /(^|\n)\s*(chief complaint|cc|hpi|history of present illness|ros|review of systems|pmh|past medical history|meds?|medications|allergies?|social hx|social history|family hx|fhx|family history|subjective|objective|assessment|plan|a\/p|assessment\/plan)\s*(?::|\n|$)/gi;

const sectionNameByHeading: Record<string, ClinicalSectionName> = {
  "chief complaint": "chief-complaint",
  cc: "chief-complaint",
  hpi: "history-of-present-illness",
  "history of present illness": "history-of-present-illness",
  ros: "review-of-systems",
  "review of systems": "review-of-systems",
  pmh: "past-medical-history",
  "past medical history": "past-medical-history",
  med: "medications",
  meds: "medications",
  medications: "medications",
  allergy: "allergies",
  allergies: "allergies",
  "social hx": "social-history",
  "social history": "social-history",
  "family hx": "family-history",
  fhx: "family-history",
  "family history": "family-history",
  subjective: "subjective",
  objective: "objective",
  assessment: "assessment",
  plan: "plan",
  "a/p": "assessment-plan",
  "assessment/plan": "assessment-plan"
};

export function detectClinicalSections(text: string): ClinicalSection[] {
  const matches = Array.from(text.matchAll(sectionHeadingPattern)).map((match) => {
    const prefixLength = match[1]?.length ?? 0;
    const heading = match[2].trim();
    const headingStart = match.index + prefixLength;
    return {
      heading,
      headingStart,
      contentStart: match.index + match[0].length
    };
  });

  if (!matches.length) {
    return [
      {
        id: "section-unknown-0",
        title: "Unsectioned note",
        normalizedName: "unknown",
        start: 0,
        end: text.length
      }
    ];
  }

  const sections: ClinicalSection[] = [];
  const firstHeading = matches[0];
  if (firstHeading.headingStart > 0 && text.slice(0, firstHeading.headingStart).trim()) {
    sections.push({
      id: "section-unknown-0",
      title: "Unsectioned note",
      normalizedName: "unknown",
      start: 0,
      end: firstHeading.headingStart
    });
  }

  matches.forEach((match, index) => {
    const nextHeadingStart = matches[index + 1]?.headingStart ?? text.length;
    const normalizedName = normalizeSectionHeading(match.heading);
    sections.push({
      id: `section-${normalizedName}-${index}`,
      title: formatSectionTitle(normalizedName),
      normalizedName,
      start: match.contentStart,
      end: nextHeadingStart
    });
  });

  return sections.filter((section) => section.start <= section.end);
}

export function getSectionForOffset(sections: ClinicalSection[], offset: number) {
  return sections.find((section) => offset >= section.start && offset < section.end) ?? sections[0];
}

export function getSectionLabel(sectionName?: ClinicalSectionName) {
  if (!sectionName || sectionName === "unknown") return "Unsectioned";
  return formatSectionTitle(sectionName);
}

function normalizeSectionHeading(heading: string): ClinicalSectionName {
  const normalized = heading.toLowerCase().replace(/\s+/g, " ").trim();
  return sectionNameByHeading[normalized] ?? "unknown";
}

function formatSectionTitle(sectionName: ClinicalSectionName) {
  return sectionName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
