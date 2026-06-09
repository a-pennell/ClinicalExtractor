import artifactJson from "./riskModelArtifact.json";
import type { LabeledRiskCase } from "./mockRiskDataset";
import type { RiskFeatureName, RiskFeatureVector } from "./riskFeatures";

export type RiskNormalizationSpec = {
  center: number;
  scale: number;
};

export type RiskModelArtifact = {
  modelId: string;
  version: string;
  trainedAt: string;
  modelType: "logistic-regression";
  outcomeLabel: string;
  trainingData: string;
  featureNames: RiskFeatureName[];
  intercept: number;
  weights: Record<RiskFeatureName, number>;
  normalization: Record<RiskFeatureName, RiskNormalizationSpec>;
  thresholds: {
    decision: number;
    low: number;
    high: number;
  };
  calibration: {
    method: string;
    note: string;
  };
};

export type RiskPrediction = {
  label: string;
  probability: number;
  rawProbability: number;
  band: "low" | "moderate" | "high";
  decision: "below-threshold" | "above-threshold";
  threshold: number;
  drivers: string[];
  modelId: string;
  modelVersion: string;
  trainedAt: string;
  outcomeLabel: string;
  disclaimer: string;
};

export type RiskEvaluationMetrics = {
  n: number;
  positives: number;
  negatives: number;
  threshold: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  brierScore: number;
};

export const riskModelArtifact = artifactJson as RiskModelArtifact;

const driverLabels: Record<RiskFeatureName, string> = {
  entity_count: "Entity volume",
  problem_count_present: "Present problems",
  medication_count: "Medication context",
  plan_count: "Care plan activity",
  functional_limitation_count: "Functional limitation burden",
  high_priority_count: "High-priority review flags",
  pain_rating__last: "Pain rating",
  pain_rating__missing: "Pain missing",
  heart_rate__mean: "Heart rate",
  heart_rate__missing: "HR missing",
  bp_systolic__last: "Systolic BP",
  bp_diastolic__last: "Diastolic BP",
  bp_missing: "BP missing",
  phq9__max: "PHQ-9",
  phq9__missing: "PHQ-9 missing",
  gad7__max: "GAD-7",
  si__present: "SI present/possible",
  si__explicitly_negated: "SI explicitly negated"
};

export function predictRisk(
  features: RiskFeatureVector,
  artifact: RiskModelArtifact = riskModelArtifact
): RiskPrediction {
  const contributions = artifact.featureNames.map((feature) => {
    const normalizedValue = normalizeFeature(feature, features, artifact.normalization[feature]);
    return {
      feature,
      contribution: normalizedValue * artifact.weights[feature],
      rawValue: features[feature]
    };
  });
  const logit = contributions.reduce((sum, row) => sum + row.contribution, artifact.intercept);
  const rawProbability = sigmoid(logit);
  const probability = Number(rawProbability.toFixed(3));
  const band = probability >= artifact.thresholds.high ? "high" : probability >= artifact.thresholds.low ? "moderate" : "low";
  const decision = probability >= artifact.thresholds.decision ? "above-threshold" : "below-threshold";

  return {
    label: "Prototype ML risk score",
    probability,
    rawProbability,
    band,
    decision,
    threshold: artifact.thresholds.decision,
    drivers: buildDrivers(contributions),
    modelId: artifact.modelId,
    modelVersion: artifact.version,
    trainedAt: artifact.trainedAt,
    outcomeLabel: artifact.outcomeLabel,
    disclaimer: "Prototype model trained only on mock labels; not calibrated or clinically validated."
  };
}

export function evaluateRiskModel(
  cases: LabeledRiskCase[],
  artifact: RiskModelArtifact = riskModelArtifact
): RiskEvaluationMetrics {
  const scoredCases = cases.map((item) => ({
    label: item.label,
    probability: predictRisk(item.features, artifact).probability
  }));
  const positives = scoredCases.filter((item) => item.label === 1).length;
  const negatives = scoredCases.length - positives;
  const threshold = artifact.thresholds.decision;
  const truePositives = scoredCases.filter((item) => item.label === 1 && item.probability >= threshold).length;
  const falsePositives = scoredCases.filter((item) => item.label === 0 && item.probability >= threshold).length;
  const trueNegatives = scoredCases.filter((item) => item.label === 0 && item.probability < threshold).length;
  const falseNegatives = scoredCases.filter((item) => item.label === 1 && item.probability < threshold).length;
  const precision = safeDivide(truePositives, truePositives + falsePositives);
  const recall = safeDivide(truePositives, truePositives + falseNegatives);

  return {
    n: scoredCases.length,
    positives,
    negatives,
    threshold,
    accuracy: safeDivide(truePositives + trueNegatives, scoredCases.length),
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    rocAuc: calculateRocAuc(scoredCases),
    prAuc: calculateAveragePrecision(scoredCases),
    brierScore: calculateBrierScore(scoredCases)
  };
}

function normalizeFeature(feature: RiskFeatureName, features: RiskFeatureVector, spec: RiskNormalizationSpec) {
  const value = getModelFeatureValue(feature, features, spec.center);
  if (!Number.isFinite(value) || !Number.isFinite(spec.scale) || spec.scale === 0) return 0;
  return (value - spec.center) / spec.scale;
}

function getModelFeatureValue(feature: RiskFeatureName, features: RiskFeatureVector, neutralValue: number) {
  if (feature === "heart_rate__mean" && features.heart_rate__missing === 1) return neutralValue;
  if ((feature === "bp_systolic__last" || feature === "bp_diastolic__last") && features.bp_missing === 1) {
    return neutralValue;
  }
  return features[feature];
}

function buildDrivers(contributions: { feature: RiskFeatureName; contribution: number; rawValue: number }[]) {
  const drivers = contributions
    .filter((row) => Math.abs(row.contribution) >= 0.08)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5)
    .map((row) => `${driverLabels[row.feature]} ${formatSigned(row.contribution)}`);

  return drivers.length ? drivers : ["No elevated model drivers from extracted features"];
}

function calculateRocAuc(scoredCases: { label: 0 | 1; probability: number }[]) {
  const positives = scoredCases.filter((item) => item.label === 1);
  const negatives = scoredCases.filter((item) => item.label === 0);
  if (!positives.length || !negatives.length) return 0;

  let wins = 0;
  positives.forEach((positive) => {
    negatives.forEach((negative) => {
      if (positive.probability > negative.probability) wins += 1;
      if (positive.probability === negative.probability) wins += 0.5;
    });
  });

  return wins / (positives.length * negatives.length);
}

function calculateAveragePrecision(scoredCases: { label: 0 | 1; probability: number }[]) {
  const sorted = [...scoredCases].sort((a, b) => b.probability - a.probability);
  const positives = sorted.filter((item) => item.label === 1).length;
  if (!positives) return 0;

  let truePositives = 0;
  let precisionSum = 0;
  sorted.forEach((item, index) => {
    if (item.label === 1) {
      truePositives += 1;
      precisionSum += truePositives / (index + 1);
    }
  });

  return precisionSum / positives;
}

function calculateBrierScore(scoredCases: { label: 0 | 1; probability: number }[]) {
  if (!scoredCases.length) return 0;
  const squaredErrors = scoredCases.map((item) => (item.probability - item.label) ** 2);
  return squaredErrors.reduce((sum, value) => sum + value, 0) / scoredCases.length;
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
