import { describe, expect, it } from "vitest";
import { detectClinicalContext, resolveExtractionSpecialties } from "./clinicalContext";

describe("clinicalContext", () => {
  it("detects primary care context from labs, vitals, and chronic disease shorthand", () => {
    const context = detectClinicalContext("HTN and T2DM. A1c 7.8. BP 128/82.");

    expect(context.primarySpecialty).toBe("primary-care");
    expect(context.activeSpecialties).toContain("primary-care");
    expect(context.lexicalSignals.some((signal) => signal.includes("primary care"))).toBe(true);
  });

  it("detects mental health context and resolves SI toward suicidal ideation", () => {
    const context = detectClinicalContext("Low mood. Denies SI/HI. PHQ-9 18. CBT weekly.");

    expect(context.primarySpecialty).toBe("mental-health");
    expect(context.activeSpecialties).toContain("mental-health");
    expect(context.ambiguityWarnings.find((warning) => warning.abbreviation === "SI")?.chosenMeaning).toBe(
      "suicidal ideation"
    );
  });

  it("detects physical therapy context and resolves PT toward physical therapy when nearby rehab terms exist", () => {
    const context = detectClinicalContext("Referral to PT. ROM limited. HEP reviewed.");

    expect(context.primarySpecialty).toBe("physical-therapy");
    expect(context.activeSpecialties).toContain("physical-therapy");
    expect(context.ambiguityWarnings.find((warning) => warning.abbreviation === "PT")?.chosenMeaning).toBe(
      "physical therapy"
    );
  });

  it("uses explicit override specialties for backwards compatibility", () => {
    const context = detectClinicalContext("PHQ-9 18. CBT weekly.");

    expect(resolveExtractionSpecialties({ specialty: "primary-care" }, context)).toEqual(["primary-care"]);
    expect(resolveExtractionSpecialties({ mode: "auto", specialty: "primary-care" }, context)).toContain(
      "mental-health"
    );
  });
});
