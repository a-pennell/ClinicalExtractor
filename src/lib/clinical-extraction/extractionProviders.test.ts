import { describe, expect, it } from "vitest";
import { createDisabledExtractionProvider, localRuleExtractionProvider } from "./extractionProviders";

describe("extractionProviders", () => {
  it("wraps the local rule extractor behind a provider interface", async () => {
    const result = await localRuleExtractionProvider.extract("Denies SI. PHQ-9 18.", { mode: "auto" });

    expect(result.providerId).toBe("local-rules");
    expect(result.context.primarySpecialty).toBe("mental-health");
    expect(result.entities.some((entity) => entity.canonicalName === "suicidal ideation")).toBe(true);
  });

  it("keeps future external providers disabled with local fallback", async () => {
    const provider = createDisabledExtractionProvider("llm-extractor-placeholder");
    const result = await provider.extract("BP 120/80.", { mode: "auto" });

    expect(result.providerId).toBe("llm-extractor-placeholder");
    expect(result.warnings[0]).toContain("local rules");
    expect(result.entities.some((entity) => entity.canonicalName === "blood pressure")).toBe(true);
  });
});
