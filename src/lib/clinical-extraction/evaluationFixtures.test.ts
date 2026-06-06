import { describe, expect, it } from "vitest";
import { evaluateExtractionFixtures, evaluationFixtures } from "./evaluationFixtures";
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
    expect(result.recall).toBeGreaterThanOrEqual(0.9);
    expect(result.caseResults.flatMap((caseResult) => caseResult.missedCanonicalNames)).toEqual([]);
  });
});
