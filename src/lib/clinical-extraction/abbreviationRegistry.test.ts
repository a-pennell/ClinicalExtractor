import { describe, expect, it } from "vitest";
import { abbreviationRegistry, resolveAbbreviations } from "./abbreviationRegistry";
import { detectClinicalContext } from "./clinicalContext";

describe("abbreviationRegistry", () => {
  it("keeps ASHA-style abbreviations as sourced registry entries", () => {
    const bp = abbreviationRegistry.find((entry) => entry.abbreviation === "BP");
    const pt = abbreviationRegistry.find((entry) => entry.abbreviation === "PT");

    expect(bp?.source.name).toBe("ASHA Common Medical Abbreviations");
    expect(bp?.safeForDirectExtraction).toBe(true);
    expect(pt?.ambiguous).toBe(true);
  });

  it("resolves ambiguous abbreviations from note context", () => {
    const text = "Referral to PT for ROM. Denies SI/HI.";
    const context = detectClinicalContext(text);
    const resolutions = resolveAbbreviations(text, context);

    expect(resolutions.find((resolution) => resolution.abbreviation === "PT")?.chosenMeaning).toBe("physical therapy");
    expect(resolutions.find((resolution) => resolution.abbreviation === "ROM")?.chosenMeaning).toBe("range of motion");
    expect(resolutions.find((resolution) => resolution.abbreviation === "SI")?.chosenMeaning).toBe("suicidal ideation");
  });

  it("uses mention-local evidence before document-wide context", () => {
    const text = "Pt reports fatigue. Referral to PT for ROM and HEP.";
    const context = detectClinicalContext(text);
    const resolutions = resolveAbbreviations(text, context);
    const ptResolution = resolutions.find((resolution) => resolution.abbreviation === "PT");

    expect(ptResolution?.chosenMeaning).toBe("physical therapy");
    expect(ptResolution?.evidence).toEqual(expect.arrayContaining(["referral", "ROM"]));
    expect(ptResolution?.mentionCount).toBe(2);
  });

  it("tracks a broader ASHA-style starter registry without treating it as exhaustive", () => {
    expect(abbreviationRegistry.length).toBeGreaterThan(35);
    expect(abbreviationRegistry.find((entry) => entry.abbreviation === "CA")?.ambiguous).toBe(true);
    expect(abbreviationRegistry.find((entry) => entry.abbreviation === "WFL")?.safeForDirectExtraction).toBe(true);
  });
});
