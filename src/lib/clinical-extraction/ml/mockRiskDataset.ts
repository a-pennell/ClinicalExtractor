import datasetJson from "./mockRiskDataset.json";
import type { RiskFeatureVector } from "./riskFeatures";

export type RiskDatasetSplit = "train" | "validation" | "holdout";

export type LabeledRiskCase = {
  id: string;
  split: RiskDatasetSplit;
  label: 0 | 1;
  features: RiskFeatureVector;
};

export const mockRiskDataset = datasetJson as LabeledRiskCase[];
