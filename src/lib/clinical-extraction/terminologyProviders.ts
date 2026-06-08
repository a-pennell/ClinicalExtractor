import { localTerminologyLookup } from "./terminologyMappings";
import type { CandidateCoding, Specialty, TerminologySystem } from "./types";
import type { TerminologyLookup, TerminologyLookupInput } from "./terminologyMappings";

export type TerminologyProviderId =
  | "local-static"
  | "mock-fhir-terminology"
  | "mock-async-fhir-terminology"
  | "fhir-terminology-service";

export type TerminologyLookupRequest = TerminologyLookupInput & {
  operation?: "$lookup";
  specialty?: Specialty;
  preferredSystems?: TerminologySystem[];
};

export type TerminologyExpandRequest = {
  operation?: "$expand";
  filter: string;
  system?: TerminologySystem;
  specialty?: Specialty;
  limit?: number;
  valueSetUrl?: string;
};

export type TerminologyLookupResult = {
  providerId: TerminologyProviderId;
  candidates: CandidateCoding[];
  warnings?: string[];
};

export type TerminologyExpandResult = {
  providerId: TerminologyProviderId;
  filter: string;
  candidates: CandidateCoding[];
  warnings?: string[];
};

export type TerminologyProvider = {
  id: TerminologyProviderId;
  label: string;
  lookup: (request: TerminologyLookupRequest) => TerminologyLookupResult;
};

export type AsyncTerminologyProvider = {
  id: TerminologyProviderId;
  label: string;
  lookup: (request: TerminologyLookupRequest) => Promise<TerminologyLookupResult>;
  expand: (request: TerminologyExpandRequest) => Promise<TerminologyExpandResult>;
};

export type FhirTerminologyProviderConfig = {
  baseUrl?: string;
  enabled?: boolean;
  fetchImpl?: typeof fetch;
};

export const localStaticTerminologyProvider: TerminologyProvider = {
  id: "local-static",
  label: "Local static terminology map",
  lookup(request) {
    return {
      providerId: "local-static",
      candidates: filterByPreferredSystems(localTerminologyLookup.lookupCandidates(request), request.preferredSystems)
    };
  }
};

export const mockFhirTerminologyProvider: TerminologyProvider = {
  id: "mock-fhir-terminology",
  label: "Mock FHIR Terminology adapter",
  lookup(request) {
    return {
      providerId: "mock-fhir-terminology",
      candidates: filterByPreferredSystems(localTerminologyLookup.lookupCandidates(request), request.preferredSystems),
      warnings: ["Prototype adapter only; no external terminology service was called."]
    };
  }
};

export const mockAsyncFhirTerminologyProvider: AsyncTerminologyProvider = {
  id: "mock-async-fhir-terminology",
  label: "Mock async FHIR Terminology adapter",
  async lookup(request) {
    return {
      providerId: "mock-async-fhir-terminology",
      candidates: filterByPreferredSystems(localTerminologyLookup.lookupCandidates(request), request.preferredSystems),
      warnings: ["Mock async adapter only; no FHIR Terminology $lookup request was sent."]
    };
  },
  async expand(request) {
    return {
      providerId: "mock-async-fhir-terminology",
      filter: request.filter,
      candidates: expandMockCandidates(request),
      warnings: ["Mock async adapter only; no FHIR Terminology $expand request was sent."]
    };
  }
};

export function createFhirTerminologyServiceProvider(
  config: FhirTerminologyProviderConfig = {}
): AsyncTerminologyProvider {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const baseUrl = config.baseUrl?.replace(/\/$/, "");

  return {
    id: "fhir-terminology-service",
    label: "FHIR Terminology service",
    async lookup(request) {
      if (!config.enabled || !baseUrl || !fetchImpl) {
        return disabledFhirResult(request, "lookup");
      }

      const expandResult = await expandAgainstFhirService(
        {
          filter: request.canonicalName,
          system: request.preferredSystems?.[0],
          specialty: request.specialty,
          limit: 8
        },
        baseUrl,
        fetchImpl
      );

      return {
        providerId: "fhir-terminology-service",
        candidates: filterByPreferredSystems(expandResult.candidates, request.preferredSystems),
        warnings: expandResult.warnings
      };
    },
    async expand(request) {
      if (!config.enabled || !baseUrl || !fetchImpl) {
        return {
          providerId: "fhir-terminology-service",
          filter: request.filter,
          candidates: expandMockCandidates(request),
          warnings: ["FHIR terminology service is disabled; returned local fallback expansion candidates."]
        };
      }

      return expandAgainstFhirService(request, baseUrl, fetchImpl);
    }
  };
}

export function createTerminologyLookup(provider: TerminologyProvider): TerminologyLookup {
  return {
    lookupCandidates(input) {
      return provider.lookup(input).candidates;
    }
  };
}

export function lookupWithTerminologyProvider(
  request: TerminologyLookupRequest,
  provider: TerminologyProvider = localStaticTerminologyProvider
) {
  return provider.lookup(request);
}

export function lookupWithAsyncTerminologyProvider(
  request: TerminologyLookupRequest,
  provider: AsyncTerminologyProvider = mockAsyncFhirTerminologyProvider
) {
  return provider.lookup(request);
}

export function expandWithAsyncTerminologyProvider(
  request: TerminologyExpandRequest,
  provider: AsyncTerminologyProvider = mockAsyncFhirTerminologyProvider
) {
  return provider.expand(request);
}

function filterByPreferredSystems(candidates: CandidateCoding[], preferredSystems?: TerminologySystem[]) {
  if (!preferredSystems?.length) return candidates;
  return candidates.filter((candidate) => preferredSystems.includes(candidate.system));
}

function disabledFhirResult(request: TerminologyLookupRequest, operation: "lookup"): TerminologyLookupResult {
  return {
    providerId: "fhir-terminology-service",
    candidates: filterByPreferredSystems(localTerminologyLookup.lookupCandidates(request), request.preferredSystems),
    warnings: [`FHIR terminology service ${operation} is disabled; returned local fallback candidates.`]
  };
}

async function expandAgainstFhirService(
  request: TerminologyExpandRequest,
  baseUrl: string,
  fetchImpl: typeof fetch
): Promise<TerminologyExpandResult> {
  const url = new URL(`${baseUrl}/ValueSet/$expand`);
  url.searchParams.set("filter", request.filter);
  url.searchParams.set("count", String(request.limit ?? 10));
  if (request.system) url.searchParams.set("system", request.system);
  if (request.valueSetUrl) url.searchParams.set("url", request.valueSetUrl);

  const response = await fetchImpl(url);
  if (!response.ok) {
    return {
      providerId: "fhir-terminology-service",
      filter: request.filter,
      candidates: expandMockCandidates(request),
      warnings: [`FHIR terminology service returned ${response.status}; local fallback candidates are shown.`]
    };
  }

  const payload = (await response.json()) as FhirValueSetExpansion;
  return {
    providerId: "fhir-terminology-service",
    filter: request.filter,
    candidates: fhirExpansionToCandidates(payload, request).slice(0, request.limit ?? 10),
    warnings: ["FHIR terminology candidates are unselected and require clinical review."]
  };
}

type FhirValueSetExpansion = {
  expansion?: {
    contains?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
  };
};

function fhirExpansionToCandidates(payload: FhirValueSetExpansion, request: TerminologyExpandRequest): CandidateCoding[] {
  return (payload.expansion?.contains ?? []).flatMap((contains) => {
    const system = mapFhirSystemToTerminologySystem(contains.system, request.system);
    if (!system || !contains.code || !contains.display) return [];
    return [
      {
        system,
        code: contains.code,
        display: contains.display,
        confidence: "low",
        status: "candidate",
        rationale: "Candidate returned by configured FHIR Terminology $expand service."
      }
    ];
  });
}

function mapFhirSystemToTerminologySystem(systemUrl?: string, requestedSystem?: TerminologySystem): TerminologySystem | null {
  if (requestedSystem) return requestedSystem;
  if (!systemUrl) return null;
  if (systemUrl.includes("icd-10-cm")) return "ICD-10-CM";
  if (systemUrl.includes("snomed")) return "SNOMED-CT";
  if (systemUrl.includes("loinc")) return "LOINC";
  if (systemUrl.includes("rxnorm")) return "RxNorm";
  if (systemUrl.includes("cpt")) return "CPT";
  if (systemUrl.includes("hcpcs")) return "HCPCS";
  return null;
}

function expandMockCandidates(request: TerminologyExpandRequest) {
  const normalizedFilter = request.filter.toLowerCase().trim();
  const limit = request.limit ?? 10;
  const candidates = mockExpansionRequests.flatMap((candidateRequest) => {
    const localCandidates = localTerminologyLookup.lookupCandidates(candidateRequest);
    return localCandidates.filter((coding) => {
      const matchesSystem = request.system ? coding.system === request.system : true;
      const searchableText = `${candidateRequest.canonicalName} ${coding.code} ${coding.display}`.toLowerCase();
      return matchesSystem && searchableText.includes(normalizedFilter);
    });
  });

  return dedupeCodings(candidates).slice(0, limit);
}

function dedupeCodings(candidates: CandidateCoding[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.system}:${candidate.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const mockExpansionRequests: TerminologyLookupRequest[] = [
  { canonicalName: "hypertension", type: "problem" },
  { canonicalName: "type 2 diabetes mellitus", type: "problem" },
  { canonicalName: "hyperlipidemia", type: "problem" },
  { canonicalName: "asthma", type: "problem" },
  { canonicalName: "chronic obstructive pulmonary disease", type: "problem" },
  { canonicalName: "major depressive disorder", type: "problem" },
  { canonicalName: "generalized anxiety disorder", type: "problem" },
  { canonicalName: "low back pain", type: "problem" },
  { canonicalName: "shoulder pain", type: "problem" },
  { canonicalName: "hemoglobin A1c", type: "lab" },
  { canonicalName: "blood pressure", type: "vital" },
  { canonicalName: "Patient Health Questionnaire-9", type: "score" },
  { canonicalName: "sertraline", type: "medication", attributes: { normalizedTerm: "sertraline" } },
  { canonicalName: "metformin", type: "medication", attributes: { normalizedTerm: "metformin" } },
  { canonicalName: "atorvastatin", type: "medication", attributes: { normalizedTerm: "atorvastatin" } },
  { canonicalName: "albuterol", type: "medication", attributes: { normalizedTerm: "albuterol" } }
];
