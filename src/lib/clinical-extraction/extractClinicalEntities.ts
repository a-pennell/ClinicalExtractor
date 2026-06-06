import { entityPatterns } from "./abbreviationDictionaries";
import { dedupeEntities } from "./dedupeEntities";
import { linkEntityRelations } from "./entityRelations";
import { isNegated, isOrdered } from "./negationRules";
import { detectRegexEntities } from "./regexPatterns";
import { detectClinicalSections, getSectionForOffset } from "./sectionParser";
import { specialtyMatches } from "./specialtyProfiles";
import { addCandidateCodings } from "./terminologyMappings";
import { annotateEntityUncertainty } from "./uncertainty";
import type { AssertionStatus, ClinicalEntity, ClinicalSection, EntityPattern, ExtractionOptions, Segment } from "./types";

export function extractClinicalEntities(rawText: string, options: ExtractionOptions): ClinicalEntity[] {
  return extractClinicalEntityDocument(rawText, options).entities;
}

export function extractClinicalEntityDocument(rawText: string, options: ExtractionOptions) {
  const text = rawText.trim();
  const sections = detectClinicalSections(rawText);
  if (!text) return { sections, entities: [] };

  const segments = splitIntoSegments(rawText, sections);
  const dictionaryEntities = entityPatterns
    .filter((pattern) => specialtyMatches(options.specialty, pattern.specialties))
    .flatMap((pattern) => detectPattern(rawText, segments, pattern));

  const regexEntities = detectRegexEntities(rawText, segments, options.specialty).map((entity, index) => ({
    id: buildId(entity.type, entity.canonicalName, index + dictionaryEntities.length),
    ...entity
  }));

  const codedEntities = dedupeEntities(dictionaryEntities.concat(regexEntities)).map((entity, index) =>
    addCandidateCodings({
      ...entity,
      id: buildId(entity.type, entity.canonicalName, index)
    })
  );
  const entities = annotateEntityUncertainty(linkEntityRelations(codedEntities));

  return { sections, entities };
}

export function splitIntoSegments(text: string, sections: ClinicalSection[] = detectClinicalSections(text)): Segment[] {
  const segments: Segment[] = [];
  const regex = /[^.!?\n]+[.!?\n]?/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    const raw = match[0];
    const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const start = match.index + leadingWhitespace;
    segments.push({
      text: trimmed,
      start,
      end: start + trimmed.length,
      section: getSectionForSegment(sections, start, start + trimmed.length)
    });
  }

  return segments.length
    ? segments
    : [{ text, start: 0, end: text.length, section: getSectionForOffset(sections, 0)?.normalizedName }];
}

function getSectionForSegment(sections: ClinicalSection[], start: number, end: number) {
  return (
    sections.find((section) => start >= section.start && start < section.end)?.normalizedName ??
    sections.find((section) => section.start >= start && section.start < end)?.normalizedName ??
    getSectionForOffset(sections, start)?.normalizedName
  );
}

function detectPattern(text: string, segments: Segment[], pattern: EntityPattern): ClinicalEntity[] {
  return pattern.terms.flatMap((term, termIndex) => {
    const regex = makeTermRegex(term);
    const matches: ClinicalEntity[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
      const segment = segments.find((candidate) => match && match.index >= candidate.start && match.index < candidate.end);
      const negated = segment ? isNegated(segment, match.index) : false;
      const ordered = segment ? isOrdered(segment, match.index) : false;
      const laterality = detectLaterality(match[0], segment?.text ?? "");
      const assertion = resolveAssertion(pattern.type, negated, ordered, segment?.section);
      const temporality = resolveTemporality(segment?.section);

      matches.push({
        id: buildId(pattern.type, pattern.canonicalName, match.index + termIndex),
        canonicalName: pattern.canonicalName,
        displayName: pattern.displayName ?? titleCase(pattern.canonicalName),
        type: pattern.type,
        specialties: pattern.specialties,
        mentions: [
          {
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            sentence: segment?.text,
            section: segment?.section
          }
        ],
        attributes: {
          assertion,
          laterality,
          normalizedTerm: pattern.canonicalName,
          temporality
        },
        confidence: pattern.confidence ?? (term.length <= 3 ? "medium" : "high"),
        explanation: `Matched ${term === pattern.canonicalName ? "dictionary term" : `term "${term}"`} and normalized to ${pattern.canonicalName}.`
      });
    }

    return matches;
  });
}

function resolveAssertion(
  type: EntityPattern["type"],
  negated: boolean,
  ordered: boolean,
  section?: Segment["section"]
): AssertionStatus {
  if (negated) return "absent";
  if (ordered) return "ordered";
  if (section === "family-history") return "family-history";
  if (section === "plan" || section === "assessment-plan") {
    if (["plan", "referral", "procedure", "imaging", "exercise"].includes(type)) return "planned";
  }
  return "present";
}

function resolveTemporality(section?: Segment["section"]): NonNullable<ClinicalEntity["attributes"]>["temporality"] | undefined {
  if (section === "past-medical-history") return "past";
  return undefined;
}

function makeTermRegex(term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isSymbolTerm = /[^A-Za-z0-9\s]/.test(term);
  const boundary = isSymbolTerm ? "(?<![A-Za-z0-9])" : "(?<![A-Za-z0-9])";
  const endBoundary = isSymbolTerm ? "(?![A-Za-z0-9])" : "(?![-A-Za-z0-9])";
  return new RegExp(`${boundary}${escaped}${endBoundary}`, "gi");
}

function detectLaterality(mention: string, sentence: string): NonNullable<ClinicalEntity["attributes"]>["laterality"] | undefined {
  const context = `${mention} ${sentence.slice(0, 24)}`.toLowerCase();
  if (/\b(bilateral|bilat)\b/.test(context)) return "bilateral";
  if (/\b(r|right)\b/.test(context)) return "right";
  if (/\b(l|left)\b/.test(context)) return "left";
  return undefined;
}

function buildId(type: string, canonicalName: string, seed: number) {
  const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${type}-${slug}-${seed}`;
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
