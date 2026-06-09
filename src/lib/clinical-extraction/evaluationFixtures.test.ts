import { describe, expect, it } from "vitest";
import {
  ambiguityEvaluationFixtures,
  buildEvaluationCoverageDashboard,
  evaluateAmbiguityFixtures,
  evaluateExtractionFixtures,
  evaluationFixtures
} from "./evaluationFixtures";
import type { Specialty } from "./types";

describe("evaluationFixtures", () => {
  it("scores starter clinical notes against expected canonical entities", () => {
    const result = evaluateExtractionFixtures();
    const fixtureCountsBySpecialty = evaluationFixtures.reduce<Record<Specialty, number>>(
      (counts, fixture) => {
        counts[fixture.specialty] += 1;
        return counts;
      },
      {
        "primary-care": 0,
        "mental-health": 0,
        "physical-therapy": 0,
        mixed: 0
      }
    );

    expect(evaluationFixtures).toHaveLength(20);
    expect(fixtureCountsBySpecialty).toEqual({
      "primary-care": 5,
      "mental-health": 5,
      "physical-therapy": 5,
      mixed: 5
    });
    expect(result.totalExpected).toBeGreaterThan(100);
    expect(result.totalFound).toBeGreaterThanOrEqual(result.totalMatched);
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThanOrEqual(0.9);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.caseResults.flatMap((caseResult) => caseResult.missedCanonicalNames)).toEqual([]);
  });

  it("builds dashboard coverage by specialty, type, assertion, and terminology system", () => {
    const dashboard = buildEvaluationCoverageDashboard();

    expect(dashboard.totalNotes).toBe(20);
    expect(dashboard.totalExpected).toBeGreaterThan(100);
    expect(dashboard.totalFound).toBeGreaterThanOrEqual(dashboard.totalMatched);
    expect(dashboard.totalMissed).toBe(0);
    expect(dashboard.precision).toBeGreaterThan(0);
    expect(dashboard.f1).toBeGreaterThan(0);
    expect(dashboard.bySpecialty).toHaveLength(4);
    expect(dashboard.bySpecialty.every((row) => row.recall === 1)).toBe(true);
    expect(dashboard.bySpecialty.every((row) => typeof row.f1 === "number")).toBe(true);
    expect(dashboard.byEntityType.some((row) => row.key === "problem" && (row.foundCount ?? 0) > 0)).toBe(true);
    expect(dashboard.byAssertion.some((row) => row.key === "absent" && (row.foundCount ?? 0) > 0)).toBe(true);
    expect(dashboard.byTerminologySystem.some((row) => row.key === "ICD-10-CM" && (row.candidateCount ?? 0) > 0)).toBe(true);
  });

  it("scores ambiguity-specific eval fixtures", () => {
    const result = evaluateAmbiguityFixtures();

    expect(ambiguityEvaluationFixtures).toHaveLength(3);
    expect(result.every((caseResult) => caseResult.missedResolutions.length === 0)).toBe(true);
  });
});
