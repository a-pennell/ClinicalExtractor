import { readFileSync } from "node:fs";
import { join } from "node:path";

const artifactPath = join(process.cwd(), "src/lib/clinical-extraction/ml/riskModelArtifact.json");
const datasetPath = join(process.cwd(), "src/lib/clinical-extraction/ml/mockRiskDataset.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));

const learningRate = 0.15;
const l2 = 0.015;
const epochs = 2400;
const featureNames = artifact.featureNames;
let intercept = 0;
const weights = Object.fromEntries(featureNames.map((feature) => [feature, 0]));

for (let epoch = 0; epoch < epochs; epoch += 1) {
  let interceptGradient = 0;
  const gradients = Object.fromEntries(featureNames.map((feature) => [feature, 0]));

  dataset.forEach((row) => {
    const probability = sigmoid(intercept + dot(weights, row.features));
    const error = probability - row.label;
    interceptGradient += error;
    featureNames.forEach((feature) => {
      gradients[feature] += error * normalizeFeature(feature, row.features, artifact.normalization[feature]);
    });
  });

  intercept -= learningRate * (interceptGradient / dataset.length);
  featureNames.forEach((feature) => {
    weights[feature] -= learningRate * (gradients[feature] / dataset.length + l2 * weights[feature]);
  });
}

const trainedArtifact = {
  ...artifact,
  intercept: Number(intercept.toFixed(4)),
  weights: Object.fromEntries(featureNames.map((feature) => [feature, Number(weights[feature].toFixed(4))]))
};

const metrics = evaluate(dataset, trainedArtifact);
console.log(JSON.stringify({ artifact: trainedArtifact, metrics }, null, 2));

function evaluate(rows, model) {
  const scored = rows.map((row) => ({
    label: row.label,
    probability: sigmoid(model.intercept + dot(model.weights, row.features))
  }));
  const threshold = model.thresholds.decision;
  const tp = scored.filter((row) => row.label === 1 && row.probability >= threshold).length;
  const fp = scored.filter((row) => row.label === 0 && row.probability >= threshold).length;
  const tn = scored.filter((row) => row.label === 0 && row.probability < threshold).length;
  const fn = scored.filter((row) => row.label === 1 && row.probability < threshold).length;
  const precision = safeDivide(tp, tp + fp);
  const recall = safeDivide(tp, tp + fn);
  return {
    n: rows.length,
    accuracy: safeDivide(tp + tn, rows.length),
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    note: "This script trains on the mock dataset only. Use real labels and temporal splits before production use."
  };
}

function dot(weights, features) {
  return featureNames.reduce((sum, feature) => sum + weights[feature] * normalizeFeature(feature, features, artifact.normalization[feature]), 0);
}

function normalizeFeature(feature, features, spec) {
  const value = getModelFeatureValue(feature, features, spec.center);
  if (!Number.isFinite(value) || !Number.isFinite(spec.scale) || spec.scale === 0) return 0;
  return (value - spec.center) / spec.scale;
}

function getModelFeatureValue(feature, features, neutralValue) {
  if (feature === "heart_rate__mean" && features.heart_rate__missing === 1) return neutralValue;
  if ((feature === "bp_systolic__last" || feature === "bp_diastolic__last") && features.bp_missing === 1) return neutralValue;
  return features[feature];
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}
