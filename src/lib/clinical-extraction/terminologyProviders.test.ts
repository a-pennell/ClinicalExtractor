import { describe, expect, it } from "vitest";
import {
  expandWithAsyncTerminologyProvider,
  createFhirTerminologyServiceProvider,
  createTerminologyLookup,
  lookupWithAsyncTerminologyProvider,
  lookupWithTerminologyProvider,
  mockAsyncFhirTerminologyProvider,
  mockFhirTerminologyProvider
} from "./terminologyProviders";
import { addCandidateCodings } from "./terminologyMappings";
import type { ClinicalEntity } from "./types";

describe("terminologyProviders", () => {
  it("adapts a provider to the existing lookup interface", () => {
    const entity: ClinicalEntity = {
      id: "asthma-1",
      canonicalName: "asthma",
      displayName: "Asthma",
      type: "problem",
      specialties: ["primary-care"],
      mentions: [{ text: "asthma", start: 0, end: 6 }],
      confidence: "medium"
    };
    const lookup = createTerminologyLookup(mockFhirTerminologyProvider);

    expect(addCandidateCodings(entity, lookup).codings?.some((coding) => coding.code === "J45.909")).toBe(true);
  });

  it("filters provider results by preferred terminology systems", () => {
    const result = lookupWithTerminologyProvider(
      {
        canonicalName: "asthma",
        type: "problem",
        preferredSystems: ["SNOMED-CT"]
      },
      mockFhirTerminologyProvider
    );

    expect(result.providerId).toBe("mock-fhir-terminology");
    expect(result.warnings?.[0]).toContain("Prototype adapter");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].system).toBe("SNOMED-CT");
  });

  it("supports an async mock lookup shaped like a future terminology service call", async () => {
    const result = await lookupWithAsyncTerminologyProvider(
      {
        operation: "$lookup",
        canonicalName: "hemoglobin A1c",
        type: "lab",
        preferredSystems: ["LOINC"]
      },
      mockAsyncFhirTerminologyProvider
    );

    expect(result.providerId).toBe("mock-async-fhir-terminology");
    expect(result.warnings?.[0]).toContain("$lookup");
    expect(result.candidates[0]).toMatchObject({ system: "LOINC", code: "4548-4" });
  });

  it("supports async mock expansion for search-like terminology UX", async () => {
    const result = await expandWithAsyncTerminologyProvider(
      {
        operation: "$expand",
        filter: "pressure",
        system: "LOINC",
        limit: 5
      },
      mockAsyncFhirTerminologyProvider
    );

    expect(result.providerId).toBe("mock-async-fhir-terminology");
    expect(result.warnings?.[0]).toContain("$expand");
    expect(result.candidates.some((coding) => coding.code === "85354-9")).toBe(true);
    expect(result.candidates.every((coding) => coding.system === "LOINC")).toBe(true);
  });

  it("keeps the FHIR terminology service provider disabled by default with local fallback", async () => {
    const provider = createFhirTerminologyServiceProvider();
    const result = await provider.lookup({
      canonicalName: "hypertension",
      type: "problem",
      preferredSystems: ["ICD-10-CM"]
    });

    expect(result.providerId).toBe("fhir-terminology-service");
    expect(result.warnings?.[0]).toContain("disabled");
    expect(result.candidates[0].code).toBe("I10");
  });

  it("maps enabled FHIR ValueSet expansion responses to candidate codings", async () => {
    const provider = createFhirTerminologyServiceProvider({
      baseUrl: "https://terminology.example/fhir",
      enabled: true,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            resourceType: "ValueSet",
            expansion: {
              contains: [
                {
                  system: "http://loinc.org",
                  code: "85354-9",
                  display: "Blood pressure panel with all children optional"
                }
              ]
            }
          }),
          { status: 200 }
        )
    });

    const result = await provider.expand({ filter: "blood pressure", system: "LOINC", limit: 5 });

    expect(result.providerId).toBe("fhir-terminology-service");
    expect(result.candidates[0]).toMatchObject({ system: "LOINC", code: "85354-9" });
  });
});
