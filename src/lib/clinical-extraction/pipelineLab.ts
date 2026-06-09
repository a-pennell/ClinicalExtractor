import { buildEvaluationCoverageDashboard } from "./evaluationFixtures";
import type { ClinicalEntity } from "./types";

export type PipelineMode = "rules" | "llm" | "hybrid";

export type PipelineMetricRow = {
  mode: "Rules" | "LLM" | "Hybrid" | "Classic ML";
  precision?: number;
  recall?: number;
  f1?: number;
  rocAuc?: number;
  prAuc?: number;
  status: string;
};

export type FeaturePreviewRow = {
  feature: string;
  value: string | number | boolean | null;
  meaning: string;
};

export type PipelineValidationIssue = {
  entityId: string;
  label: string;
  severity: "warning" | "error";
  message: string;
};

export type TriageBlock = {
  id: string;
  route: "Rules" | "LLM";
  reason: string;
  excerpt: string;
};

export type PipelineLabSnapshot = {
  metrics: PipelineMetricRow[];
  featureRows: FeaturePreviewRow[];
  validationIssues: PipelineValidationIssue[];
  triageBlocks: TriageBlock[];
  ruleHandledCount: number;
  llmEscalationCount: number;
  compressedContext: string;
};

const llmTriggerTerms = [
  "family history",
  "family hx",
  "mother",
  "father",
  "sister",
  "brother",
  "rule out",
  "r/o",
  "concern for",
  "differential",
  "unclear",
  "complex"
];

export function buildPipelineLabSnapshot(text: string, entities: ClinicalEntity[]): PipelineLabSnapshot {
  const validationIssues = buildValidationIssues(entities);
  const triageBlocks = buildTriageBlocks(text, entities, validationIssues);
  const llmEscalationCount = triageBlocks.filter((block) => block.route === "LLM").length;

  return {
    metrics: buildMetricRows(),
    featureRows: buildFeatureRows(entities),
    validationIssues,
    triageBlocks,
    ruleHandledCount: entities.length,
    llmEscalationCount,
    compressedContext: buildCompressedContext(text, entities, triageBlocks)
  };
}

function buildMetricRows(): PipelineMetricRow[] {
  const dashboard = buildEvaluationCoverageDashboard();
  return [
    {
      mode: "Rules",
      precision: dashboard.precision,
      recall: dashboard.recall,
      f1: dashboard.f1,
      status: "Synthetic eval set"
    },
    {
      mode: "LLM",
      status: "Pending structured LLM runs"
    },
    {
      mode: "Hybrid",
      status: "Pending cascade eval"
    },
    {
      mode: "Classic ML",
      status: "Needs labels for ROC-AUC / PR-AUC"
    }
  ];
}

function buildFeatureRows(entities: ClinicalEntity[]): FeaturePreviewRow[] {
  const painValues = numericValues(entities, "pain rating");
  const phq9Values = numericValues(entities, "Patient Health Questionnaire-9");
  const heartRateValues = numericValues(entities, "heart rate");
  const bloodPressure = [...entities].reverse().find((entity) => entity.canonicalName === "blood pressure");
  const suicidalIdeation = entities.filter((entity) => entity.canonicalName === "suicidal ideation");

  return [
    {
      feature: "entity_count",
      value: entities.length,
      meaning: "Total structured mentions available for downstream models."
    },
    {
      feature: "pain_rating__last",
      value: lastValue(painValues),
      meaning: "Most recent present pain rating; null means not extracted."
    },
    {
      feature: "pain_rating__missing",
      value: painValues.length === 0,
      meaning: "Preserves extraction absence separately from a clinical denial."
    },
    {
      feature: "heart_rate__mean",
      value: meanValue(heartRateValues),
      meaning: "Mean extracted HR across present mentions in the note."
    },
    {
      feature: "bp_systolic__last",
      value: parseNumeric(bloodPressure?.attributes?.systolic),
      meaning: "Last extracted systolic BP value."
    },
    {
      feature: "bp_diastolic__last",
      value: parseNumeric(bloodPressure?.attributes?.diastolic),
      meaning: "Last extracted diastolic BP value."
    },
    {
      feature: "phq9__max",
      value: maxValue(phq9Values),
      meaning: "Highest PHQ-9 value in the current note."
    },
    {
      feature: "si__explicitly_negated",
      value: suicidalIdeation.some((entity) => entity.attributes?.assertion === "absent"),
      meaning: "Distinguishes documented denial from missing SI documentation."
    }
  ];
}

function buildValidationIssues(entities: ClinicalEntity[]): PipelineValidationIssue[] {
  return entities.flatMap((entity) => {
    const value = parseNumeric(entity.attributes?.value);
    const issues: PipelineValidationIssue[] = [];

    if (entity.canonicalName === "blood pressure") {
      const systolic = parseNumeric(entity.attributes?.systolic);
      const diastolic = parseNumeric(entity.attributes?.diastolic);
      if (systolic !== null && (systolic < 40 || systolic > 300)) {
        issues.push(buildIssue(entity, "error", `Systolic BP ${systolic} is outside 40-300.`));
      }
      if (diastolic !== null && (diastolic < 20 || diastolic > 200)) {
        issues.push(buildIssue(entity, "error", `Diastolic BP ${diastolic} is outside 20-200.`));
      }
      if (systolic !== null && diastolic !== null && systolic <= diastolic) {
        issues.push(buildIssue(entity, "error", "Systolic BP should exceed diastolic BP."));
      }
    }

    if (entity.canonicalName === "heart rate" && value !== null && (value < 20 || value > 300)) {
      issues.push(buildIssue(entity, "error", `Heart rate ${value} is outside 20-300.`));
    }

    if (entity.canonicalName === "Patient Health Questionnaire-9" && value !== null && (value < 0 || value > 27)) {
      issues.push(buildIssue(entity, "error", `PHQ-9 ${value} is outside 0-27.`));
    }

    if (entity.canonicalName === "Generalized Anxiety Disorder-7" && value !== null && (value < 0 || value > 21)) {
      issues.push(buildIssue(entity, "error", `GAD-7 ${value} is outside 0-21.`));
    }

    if (entity.canonicalName === "pain rating") {
      const severity = parsePainSeverity(entity);
      if (severity !== null && (severity < 0 || severity > 10)) {
        issues.push(buildIssue(entity, "error", `Pain rating ${severity}/10 is outside 0-10.`));
      }
    }

    if (entity.confidence === "low") {
      issues.push(buildIssue(entity, "warning", "Low-confidence extraction should be reviewed before model use."));
    }

    return issues;
  });
}

function buildTriageBlocks(
  text: string,
  entities: ClinicalEntity[],
  validationIssues: PipelineValidationIssue[]
): TriageBlock[] {
  const blocks: TriageBlock[] = [];

  entities.slice(0, 6).forEach((entity) => {
    const mention = entity.mentions[0];
    if (!mention) return;
    blocks.push({
      id: `rules-${entity.id}`,
      route: "Rules",
      reason: `${entity.type} · ${entity.confidence} confidence`,
      excerpt: mention.sentence ?? mention.text
    });
  });

  validationIssues.slice(0, 4).forEach((issue) => {
    blocks.push({
      id: `validation-${issue.entityId}`,
      route: "LLM",
      reason: issue.message,
      excerpt: entities.find((entity) => entity.id === issue.entityId)?.mentions[0]?.sentence ?? issue.label
    });
  });

  splitSentences(text).forEach((sentence, index) => {
    const normalized = sentence.toLowerCase();
    const trigger = llmTriggerTerms.find((term) => normalized.includes(term));
    if (!trigger) return;
    blocks.push({
      id: `llm-trigger-${index}`,
      route: "LLM",
      reason: `Complex context trigger: ${trigger}`,
      excerpt: sentence
    });
  });

  return dedupeTriageBlocks(blocks);
}

function buildCompressedContext(text: string, entities: ClinicalEntity[], triageBlocks: TriageBlock[]) {
  const excerpts = triageBlocks
    .filter((block) => block.route === "LLM")
    .map((block) => block.excerpt)
    .concat(entities.slice(0, 4).flatMap((entity) => entity.mentions[0]?.sentence ?? []));
  const compressed = Array.from(new Set(excerpts.map((excerpt) => excerpt.trim()).filter(Boolean))).join("\n");
  return compressed || text.trim().slice(0, 700);
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

function buildIssue(entity: ClinicalEntity, severity: PipelineValidationIssue["severity"], message: string) {
  return {
    entityId: entity.id,
    label: entity.displayName,
    severity,
    message
  };
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function dedupeTriageBlocks(blocks: TriageBlock[]) {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = `${block.route}:${block.reason}:${block.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
