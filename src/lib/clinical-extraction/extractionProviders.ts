import { extractClinicalEntityDocument } from "./extractClinicalEntities";
import type { ClinicalEntity, DetectedClinicalContext, ExtractionOptions } from "./types";

export type ExtractionProviderId =
  | "local-rules"
  | "llm-extractor-placeholder"
  | "clinical-nlp-service-placeholder";

export type ExtractionProviderResult = {
  providerId: ExtractionProviderId;
  providerLabel: string;
  context: DetectedClinicalContext;
  entities: ClinicalEntity[];
  warnings: string[];
};

export type ExtractionProvider = {
  id: ExtractionProviderId;
  label: string;
  extract: (text: string, options: ExtractionOptions) => Promise<ExtractionProviderResult>;
};

export const localRuleExtractionProvider: ExtractionProvider = {
  id: "local-rules",
  label: "Local rule-based extractor",
  async extract(text, options) {
    const document = extractClinicalEntityDocument(text, options);
    return {
      providerId: "local-rules",
      providerLabel: "Local rule-based extractor",
      context: document.context,
      entities: document.entities,
      warnings: []
    };
  }
};

export function createDisabledExtractionProvider(id: Exclude<ExtractionProviderId, "local-rules">): ExtractionProvider {
  return {
    id,
    label: id === "llm-extractor-placeholder" ? "LLM extractor placeholder" : "Clinical NLP service placeholder",
    async extract(text, options) {
      const fallback = await localRuleExtractionProvider.extract(text, options);
      return {
        ...fallback,
        providerId: id,
        providerLabel: id === "llm-extractor-placeholder" ? "LLM extractor placeholder" : "Clinical NLP service placeholder",
        warnings: ["External extraction provider is not configured; local rules were used as fallback."]
      };
    }
  };
}
