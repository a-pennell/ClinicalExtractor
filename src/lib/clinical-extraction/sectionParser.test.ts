import { describe, expect, it } from "vitest";
import { detectClinicalSections, getSectionForOffset } from "./sectionParser";

describe("sectionParser", () => {
  it("detects common note sections with source offsets", () => {
    const text = "PMH: HTN.\nMeds: lisinopril 20mg.\nFamily Hx: father with colon cancer.";
    const sections = detectClinicalSections(text);

    expect(sections.map((section) => section.normalizedName)).toEqual([
      "past-medical-history",
      "medications",
      "family-history"
    ]);
    expect(getSectionForOffset(sections, text.indexOf("father"))?.normalizedName).toBe("family-history");
  });
});
