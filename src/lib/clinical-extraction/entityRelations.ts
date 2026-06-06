import type { ClinicalEntity, EntityRelation } from "./types";

const medicationTargets: Record<string, string[]> = {
  lisinopril: ["hypertension"],
  metformin: ["type 2 diabetes mellitus"],
  sertraline: ["major depressive disorder", "depression", "generalized anxiety disorder", "anxiety"],
  fluoxetine: ["major depressive disorder", "depression", "generalized anxiety disorder", "anxiety"],
  escitalopram: ["major depressive disorder", "depression", "generalized anxiety disorder", "anxiety"],
  bupropion: ["major depressive disorder", "depression"],
  duloxetine: ["major depressive disorder", "depression", "low back pain"],
  albuterol: ["shortness of breath", "asthma"],
  atorvastatin: ["hyperlipidemia"],
  amlodipine: ["hypertension"],
  losartan: ["hypertension"],
  gabapentin: ["leg radiation", "low back pain"]
};

const measurementTargets: Record<string, string[]> = {
  "hemoglobin A1c": ["type 2 diabetes mellitus"],
  "Patient Health Questionnaire-9": ["major depressive disorder", "depression"],
  "Generalized Anxiety Disorder-7": ["generalized anxiety disorder", "anxiety"],
  "low density lipoprotein cholesterol": ["hyperlipidemia"],
  "high density lipoprotein cholesterol": ["hyperlipidemia"],
  triglycerides: ["hyperlipidemia"],
  "total cholesterol": ["hyperlipidemia"]
};

export function linkEntityRelations(entities: ClinicalEntity[]): ClinicalEntity[] {
  return entities.map((entity) => {
    const relations = buildRelationsForEntity(entity, entities);
    if (!relations.length) return entity;

    return {
      ...entity,
      relations
    };
  });
}

function buildRelationsForEntity(entity: ClinicalEntity, entities: ClinicalEntity[]) {
  const relations: EntityRelation[] = [];

  if (entity.type === "medication") {
    relations.push(
      ...targetByCanonicalNames(
        entity,
        entities,
        medicationTargets[entity.canonicalName] ?? [],
        "treats",
        "Medication has a starter indication link to a matching extracted problem or symptom."
      )
    );
  }

  if (["lab", "score", "vital"].includes(entity.type)) {
    relations.push(
      ...targetByCanonicalNames(
        entity,
        entities,
        measurementTargets[entity.canonicalName] ?? [],
        "measures",
        "Measurement has a starter link to a matching extracted condition."
      )
    );
  }

  if (entity.type === "imaging") {
    const bodySite = entity.attributes?.bodySite ?? entity.canonicalName;
    const targets = bodySite.includes("lumbar") || bodySite.includes("back") ? ["low back pain"] : bodySite.includes("shoulder") ? ["shoulder pain"] : [];
    relations.push(
      ...targetByCanonicalNames(
        entity,
        entities,
        targets,
        entity.attributes?.assertion === "ordered" ? "ordered-for" : "documents",
        "Imaging body site appears related to a matching extracted problem."
      )
    );
    relations.push(...targetNearestProblem(entity, entities, entity.attributes?.assertion === "ordered" ? "ordered-for" : "documents"));
  }

  if (entity.type === "referral" || entity.type === "plan" || entity.type === "exercise") {
    relations.push(...targetNearestProblem(entity, entities, "plan-for"));
  }

  if (entity.canonicalName === "safety plan") {
    relations.push(
      ...targetByCanonicalNames(
        entity,
        entities,
        ["suicidal ideation"],
        "supports",
        "Safety planning is commonly reviewed with suicidal ideation risk."
      )
    );
  }

  return dedupeRelations(relations);
}

function targetByCanonicalNames(
  source: ClinicalEntity,
  entities: ClinicalEntity[],
  canonicalNames: string[],
  type: EntityRelation["type"],
  explanation: string
) {
  return canonicalNames.flatMap((canonicalName) => {
    const target = entities.find((entity) => entity.id !== source.id && entity.canonicalName === canonicalName);
    return target ? [buildRelation(target, type, explanation, shareSentence(source, target) ? "high" : "medium")] : [];
  });
}

function targetNearestProblem(source: ClinicalEntity, entities: ClinicalEntity[], type: EntityRelation["type"]) {
  const problems = entities.filter(
    (entity) =>
      entity.id !== source.id &&
      ["problem", "symptom", "risk", "functional-limitation"].includes(entity.type) &&
      entity.attributes?.assertion !== "absent"
  );
  const sourceStart = source.mentions[0]?.start ?? 0;
  const target = problems
    .map((entity) => ({
      entity,
      distance: Math.min(...entity.mentions.map((mention) => Math.abs(mention.start - sourceStart)))
    }))
    .filter((candidate) => candidate.distance <= 180)
    .sort((a, b) => a.distance - b.distance)[0]?.entity;

  return target
    ? [buildRelation(target, type, "Nearest active problem or symptom in the note is within local context range.", "low")]
    : [];
}

function buildRelation(
  target: ClinicalEntity,
  type: EntityRelation["type"],
  explanation: string,
  confidence: EntityRelation["confidence"]
): EntityRelation {
  return {
    type,
    targetEntityId: target.id,
    targetCanonicalName: target.canonicalName,
    targetDisplayName: target.displayName,
    confidence,
    status: "candidate",
    explanation
  };
}

function shareSentence(source: ClinicalEntity, target: ClinicalEntity) {
  const sourceSentences = new Set(source.mentions.map((mention) => mention.sentence).filter(Boolean));
  return target.mentions.some((mention) => mention.sentence && sourceSentences.has(mention.sentence));
}

function dedupeRelations(relations: EntityRelation[]) {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    const key = `${relation.type}:${relation.targetEntityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
