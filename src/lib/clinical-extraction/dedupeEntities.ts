import type { AssertionStatus, ClinicalEntity } from "./types";

/**
 * @deprecated FROZEN — ADR-001 (docs/ADR-001-pipeline-consolidation.md).
 * The Python `clinical_nlp` package is the single extraction engine; this
 * module is legacy kept only until cutover completes. Do not add features
 * and do not import from application code. The conflict-aware rollup that
 * replaces it lives in `clinical_nlp/rollup.py`.
 *
 * Interim B6 safety patch only: the former any-absent → absent rule reported
 * actively symptomatic complaints as denied; disagreement now yields
 * "conflicting" and is surfaced for high-priority review.
 */
export function dedupeEntities(entities: ClinicalEntity[]) {
  const byKey = new Map<string, ClinicalEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.canonicalName.toLowerCase()}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...entity,
        mentions: [...entity.mentions].sort((a, b) => a.start - b.start)
      });
      continue;
    }

    existing.mentions = mergeMentions(existing.mentions.concat(entity.mentions));
    existing.attributes = {
      ...existing.attributes,
      ...entity.attributes,
      assertion: mergeAssertions(existing.attributes?.assertion, entity.attributes?.assertion)
    };
    existing.confidence = confidenceRank(entity.confidence) > confidenceRank(existing.confidence) ? entity.confidence : existing.confidence;
    if (entity.explanation && !existing.explanation?.includes(entity.explanation)) {
      existing.explanation = [existing.explanation, entity.explanation].filter(Boolean).join(" ");
    }
  }

  return suppressNestedSymptomEntities(Array.from(byKey.values())).sort((a, b) => a.mentions[0].start - b.mentions[0].start);
}

/**
 * B6 fix: contradicting mention assertions never resolve silently in either
 * direction — any disagreement is "conflicting" (sticky: a conflict never
 * un-conflicts by merging more mentions).
 */
function mergeAssertions(
  current: AssertionStatus | undefined,
  incoming: AssertionStatus | undefined
): AssertionStatus | undefined {
  if (current === "conflicting" || incoming === "conflicting") return "conflicting";
  if (!current || !incoming || current === incoming) return incoming ?? current;
  return "conflicting";
}

function mergeMentions(mentions: ClinicalEntity["mentions"]) {
  const seen = new Set<string>();
  return mentions
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    .filter((mention) => {
      const key = `${mention.start}:${mention.end}:${mention.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reduce<ClinicalEntity["mentions"]>((merged, mention) => {
      const previous = merged[merged.length - 1];
      if (previous && mention.start < previous.end) return merged;
      merged.push(mention);
      return merged;
    }, [])
    .sort((a, b) => a.start - b.start);
}

function confidenceRank(confidence: ClinicalEntity["confidence"]) {
  return { low: 1, medium: 2, high: 3 }[confidence];
}

function suppressNestedSymptomEntities(entities: ClinicalEntity[]) {
  return entities.filter((entity) => {
    if (entity.type !== "symptom") return true;

    return !entity.mentions.every((mention) =>
      entities.some(
        (other) =>
          other !== entity &&
          other.type === "problem" &&
          confidenceRank(other.confidence) >= confidenceRank(entity.confidence) &&
          other.mentions.some(
            (otherMention) =>
              mention.start >= otherMention.start &&
              mention.end <= otherMention.end &&
              otherMention.end - otherMention.start > mention.end - mention.start
          )
      )
    );
  });
}
