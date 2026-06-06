import type { ClinicalEntity, EntityUncertainty } from "./types";

const ambiguousTerms = new Set(["PT", "ER", "IR", "CP", "SI", "HI", "DM", "US"]);
const relationHelpfulTypes = new Set(["medication", "imaging", "referral", "plan", "exercise", "score"]);

export function annotateEntityUncertainty(entities: ClinicalEntity[]): ClinicalEntity[] {
  return entities.map((entity) => ({
    ...entity,
    uncertainty: assessEntityUncertainty(entity)
  }));
}

export function assessEntityUncertainty(entity: ClinicalEntity): EntityUncertainty {
  const reasons: string[] = [];

  if (entity.confidence === "low") {
    reasons.push("Low extraction confidence.");
  }

  if (entity.mentions.some((mention) => ambiguousTerms.has(mention.text.trim().toUpperCase()))) {
    reasons.push("Matched shorthand can be ambiguous outside section context.");
  }

  if (!entity.codings?.length && !["duration", "laterality", "body-site", "other"].includes(entity.type)) {
    reasons.push("No local terminology candidate yet.");
  }

  if (entity.codings?.some((coding) => coding.confidence === "low")) {
    reasons.push("One or more candidate codes are broad or underspecified.");
  }

  if (relationHelpfulTypes.has(entity.type) && !entity.relations?.length) {
    reasons.push("No linked problem, symptom, or clinical target was inferred.");
  }

  if (entity.mentions.some((mention) => !mention.section || mention.section === "unknown")) {
    reasons.push("Source text is not in a recognized note section.");
  }

  return {
    reviewPriority: rankReviewPriority(entity, reasons),
    reasons
  };
}

function rankReviewPriority(entity: ClinicalEntity, reasons: string[]): EntityUncertainty["reviewPriority"] {
  if (!reasons.length) return "routine";
  if (entity.confidence === "low" || reasons.length >= 2) return "high";
  return "needs-review";
}
