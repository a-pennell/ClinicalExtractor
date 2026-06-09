import { describe, expect, it } from "vitest";
import { mockRiskDataset } from "./mockRiskDataset";
import { evaluateRiskModel, predictRisk, riskModelArtifact } from "./riskModel";

describe("risk model prototype", () => {
  it("scores a mock-labeled holdout set with real binary classification metrics", () => {
    const metrics = evaluateRiskModel(mockRiskDataset);

    expect(metrics.n).toBeGreaterThanOrEqual(10);
    expect(metrics.positives).toBeGreaterThan(0);
    expect(metrics.negatives).toBeGreaterThan(0);
    expect(metrics.f1).toBeGreaterThan(0.7);
    expect(metrics.rocAuc).toBeGreaterThan(0.7);
    expect(metrics.prAuc).toBeGreaterThan(0.7);
  });

  it("returns consistent prediction metadata from the persisted artifact", () => {
    const highRiskCase = mockRiskDataset.find((item) => item.id === "mh-high-si");
    expect(highRiskCase).toBeTruthy();

    const prediction = predictRisk(highRiskCase!.features);

    expect(prediction.modelVersion).toBe(riskModelArtifact.version);
    expect(prediction.probability).toBeGreaterThanOrEqual(prediction.threshold);
    expect(prediction.band).toMatch(/moderate|high/);
    expect(prediction.drivers.length).toBeGreaterThan(0);
  });
});
