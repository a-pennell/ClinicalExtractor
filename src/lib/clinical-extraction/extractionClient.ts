import type { ClinicalEntity, Specialty } from "./types";

/**
 * Client for the server-side clinical_nlp extraction engine (ADR-001).
 *
 * This is the ONLY extraction path application code may grow against; the
 * legacy in-browser extractor is frozen and exists solely as a fallback until
 * the engine's lexicon coverage reaches parity (see ADR-001 implementation
 * notes — coverage expansion is gated on the labeling plan).
 */

export type EngineExtractionResult = {
  entities: ClinicalEntity[];
  escalationFailed: boolean;
  sessionId: string;
};

export async function probeEngineAvailability(fetchImpl: typeof fetch | undefined = globalThis.fetch): Promise<boolean> {
  if (!fetchImpl) return false;
  try {
    const response = await fetchImpl("/api/providers");
    if (!response.ok) return false;
    const payload = await response.json();
    return (
      Array.isArray(payload.extractionProviders) &&
      payload.extractionProviders.some(
        (provider: { id?: string; status?: string }) =>
          provider.id === "clinical-nlp-engine" && provider.status === "available"
      )
    );
  } catch {
    return false;
  }
}

export async function extractViaEngine(
  text: string,
  specialty: Specialty,
  fetchImpl: typeof fetch | undefined = globalThis.fetch
): Promise<EngineExtractionResult | null> {
  if (!fetchImpl) return null;
  const sessionId = buildSessionId();
  try {
    const response = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceText: text, specialty })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!Array.isArray(payload.entities)) return null;
    return {
      entities: payload.entities as ClinicalEntity[],
      escalationFailed: payload.escalation_failed === true,
      sessionId
    };
  } catch {
    return null;
  }
}

function buildSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
