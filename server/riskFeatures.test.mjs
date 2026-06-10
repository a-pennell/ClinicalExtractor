import { describe, expect, it } from "vitest";
import { resolveRiskFeatures } from "./api.mjs";

/**
 * C9: risk feature resolution must never silently zero-fill.
 */

const FEATURES = ["heart_rate__mean", "heart_rate__missing", "bp_systolic__last", "bp_missing"];

describe("resolveRiskFeatures", () => {
  it("uses provided finite values as-is", () => {
    const r = resolveRiskFeatures({ heart_rate__mean: 80, heart_rate__missing: 0, bp_systolic__last: 120, bp_missing: 0 }, FEATURES);
    expect(r.missingRequired).toEqual([]);
    expect(r.features.heart_rate__mean).toBe(80);
    expect(r.coerced).toEqual([]);
  });

  it("rejects a required feature with no missing-indicator signal", () => {
    const r = resolveRiskFeatures({ heart_rate__missing: 0, bp_systolic__last: 120, bp_missing: 0 }, FEATURES);
    expect(r.missingRequired).toContain("heart_rate__mean");
  });

  it("coerces a value covered by its __missing indicator and records it", () => {
    const r = resolveRiskFeatures({ heart_rate__missing: 1, bp_systolic__last: 120, bp_missing: 0 }, FEATURES);
    expect(r.missingRequired).toEqual([]);
    expect(r.features.heart_rate__mean).toBe(0);
    expect(r.coerced.some((c) => c.feature === "heart_rate__mean" && /heart_rate__missing/.test(c.reason))).toBe(true);
  });

  it("defaults an absent __missing indicator to 1 and records it", () => {
    const r = resolveRiskFeatures({ heart_rate__mean: 80, bp_systolic__last: 120, bp_missing: 0 }, FEATURES);
    expect(r.features.heart_rate__missing).toBe(1);
    expect(r.coerced.some((c) => c.feature === "heart_rate__missing")).toBe(true);
  });
});
