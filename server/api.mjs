/**
 * API request handling, extracted from server.mjs for testability (ADR-001).
 *
 * Extraction is served by the Python clinical_nlp engine via the stdio bridge
 * (server/engine.mjs); this module adapts engine envelopes to the client
 * entity shape so the TS layer renders without performing clinical inference.
 */

import { ACK_REQUIRED_TYPES, buildGatedExport } from "./exportGates.mjs";

// AUDIT FIX (B3, preserved): `Access-Control-Allow-Origin: *` plus guessable
// session ids let any third-party page a clinician visits read
// /api/sessions/:id/export, which returns sourceText (raw note / PHI).
// Cross-origin access is opt-in via CORS_ALLOW_ORIGIN.
// TODO(audit): add authn and unguessable session ids before any real notes
// touch these endpoints; the in-memory `sessions` Map is also unbounded.

const SYSTEM_LABEL_BY_URI = {
  "http://snomed.info/sct": "SNOMED-CT",
  "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
  "http://loinc.org": "LOINC",
  "http://hl7.org/fhir/sid/icd-10-cm": "ICD-10-CM",
  "http://www.ama-assn.org/go/cpt": "CPT",
  "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets": "HCPCS"
};

export function createApiHandler({ engine, riskModelArtifact, sessions = new Map(), corsAllowOrigin = process.env.CORS_ALLOW_ORIGIN || "" }) {
  return async function handleApiRequest(request, response, url) {
    if (corsAllowOrigin) {
      response.setHeader("Access-Control-Allow-Origin", corsAllowOrigin);
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "content-type");
    }
    response.setHeader("Cache-Control", "no-cache");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        service: "clinical-entity-extraction-prototype",
        mode: "engine-backed",
        extraction: "clinical-nlp-engine",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/providers") {
      let engineStatus = "unavailable";
      try {
        await engine.ping();
        engineStatus = "available";
      } catch {
        engineStatus = "unavailable";
      }
      sendJson(response, 200, {
        extractionProviders: [
          { id: "clinical-nlp-engine", label: "Python clinical_nlp engine (ADR-001)", status: engineStatus },
          { id: "local-rules", label: "Local rule-based extractor (frozen legacy, ADR-001)", status: "deprecated-client-side" }
        ],
        terminologyProviders: [
          { id: "clinical-nlp-normalization", label: "clinical_nlp normalization (release-pinning aware)", status: engineStatus },
          { id: "local-static", label: "Local static terminology map", status: "deprecated-client-side" }
        ]
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/risk/predict") {
      const body = await readJsonBody(request, response);
      if (!body) return;
      if (!body.features || typeof body.features !== "object" || Array.isArray(body.features)) {
        sendJson(response, 400, { error: "Request body must include a features object." });
        return;
      }

      // C9: never silently zero-fill. Reject requests missing required features
      // (no __missing indicator to explain the gap); coerce only features whose
      // __missing indicator is set, and echo what was coerced.
      const resolved = resolveRiskFeatures(body.features, riskModelArtifact.featureNames);
      if (resolved.missingRequired.length > 0) {
        sendJson(response, 400, {
          error: "missing-required-features",
          missingFeatures: resolved.missingRequired,
          hint: "Provide each feature, or set its __missing indicator to 1 to mark it legitimately absent."
        });
        return;
      }

      const features = resolved.features;
      const prediction = scoreRiskFeatures(features, riskModelArtifact);
      sendJson(response, 200, {
        prediction,
        features,
        coercedFeatures: resolved.coerced,
        model: {
          id: riskModelArtifact.modelId,
          version: riskModelArtifact.version,
          trainedAt: riskModelArtifact.trainedAt,
          outcomeLabel: riskModelArtifact.outcomeLabel,
          trainingData: riskModelArtifact.trainingData,
          calibration: riskModelArtifact.calibration
        },
        warning: "Prototype risk prediction is trained only on mock labels and is not clinically validated."
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/sessions") {
      const body = await readJsonBody(request, response);
      if (!body) return;
      const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `session-${Date.now()}`;
      const session = {
        id,
        schemaVersion: "prototype-1",
        specialty: typeof body.specialty === "string" ? body.specialty : "mixed",
        sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
        status: "created",
        createdAt: new Date().toISOString(),
        reviews: {}
      };
      sessions.set(id, session);
      sendJson(response, 201, session);
      return;
    }

    const extractMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/extract$/);
    if (request.method === "POST" && extractMatch) {
      const id = decodeURIComponent(extractMatch[1]);
      const body = await readJsonBody(request, response);
      if (!body) return;
      const session = sessions.get(id) ?? {
        id,
        schemaVersion: "prototype-1",
        specialty: "mixed",
        sourceText: "",
        createdAt: new Date().toISOString(),
        reviews: {}
      };
      const sourceText = typeof body.sourceText === "string" ? body.sourceText : session.sourceText;

      let envelope;
      try {
        envelope = await engine.extract(sourceText);
      } catch (error) {
        sendJson(response, 503, {
          error: "extraction-engine-unavailable",
          detail: error?.code || "engine-error"
        });
        return;
      }

      const entities = toClientEntities(envelope);
      const updated = {
        ...session,
        sourceText,
        specialty: typeof body.specialty === "string" ? body.specialty : session.specialty,
        providerId: "clinical-nlp-engine",
        status: "extracted",
        escalation_failed: envelope.escalation_failed === true,
        extraction: envelope,
        entities
      };
      sessions.set(id, updated);
      sendJson(response, 200, updated);
      return;
    }

    // Record a reviewer acknowledgment for ack-required entity types
    // (operating-point policy 6.3): reviewer id + timestamp in session state.
    const ackMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/acknowledge$/);
    if (request.method === "POST" && ackMatch) {
      const id = decodeURIComponent(ackMatch[1]);
      const session = sessions.get(id);
      if (!session) {
        sendJson(response, 404, { error: "Session not found." });
        return;
      }
      const body = await readJsonBody(request, response);
      if (!body) return;
      const reviewerId = typeof body.reviewerId === "string" ? body.reviewerId.trim() : "";
      const types = Array.isArray(body.types) ? body.types.filter((type) => ACK_REQUIRED_TYPES.has(type)) : [];
      if (!reviewerId || types.length === 0) {
        sendJson(response, 400, { error: "Acknowledgment requires reviewerId and at least one ack-required type." });
        return;
      }
      session.acknowledgments = session.acknowledgments ?? {};
      const at = new Date().toISOString();
      for (const type of types) session.acknowledgments[type] = { reviewerId, at };
      sessions.set(id, session);
      sendJson(response, 200, { id, acknowledgments: session.acknowledgments });
      return;
    }

    // Gated export (operating-point policy section 6). Enforced server-side on
    // every export path; blocked entities are never serialized.
    const exportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/export\/([^/]+)$/);
    if (request.method === "GET" && exportMatch) {
      const id = decodeURIComponent(exportMatch[1]);
      const type = decodeURIComponent(exportMatch[2]);
      const session = sessions.get(id);
      if (!session) {
        sendJson(response, 404, { error: "Session not found." });
        return;
      }
      const result = buildGatedExport(session, type);
      sendJson(response, result.status, result.payload);
      return;
    }

    sendJson(response, 404, { error: "API route not found." });
  };
}

/**
 * Adapt an engine envelope (clinical_nlp schema) to the client entity shape.
 * Rendering-only mapping — no clinical inference happens here (ADR-001).
 */
export function toClientEntities(envelope) {
  return (envelope.entities ?? []).map((entity, index) => {
    const mentions = (entity.mention_indexes ?? [])
      .map((mentionIndex) => envelope.mentions?.[mentionIndex])
      .filter(Boolean)
      .map((mention) => ({ text: mention.text, start: mention.start_char, end: mention.end_char }));
    const topScore = Math.max(0, ...(entity.mention_indexes ?? []).map((i) => envelope.mentions?.[i]?.confidence_score ?? 0));
    const reasons = [];
    if (entity.assertion === "conflicting") reasons.push("Mentions disagree on assertion; requires human resolution.");
    if (entity.assertion === "unknown") reasons.push("Assertion could not be resolved; requires human review.");
    if (!entity.is_coded) reasons.push("No release-pinned terminology candidate yet.");

    return {
      id: `${entity.entity_type}-${slugify(entity.canonical_text)}-${index}`,
      canonicalName: entity.canonical_text,
      displayName: titleCase(entity.canonical_text),
      type: entity.entity_type,
      specialties: ["mixed"],
      mentions,
      attributes: {
        assertion: entity.assertion,
        normalizedTerm: entity.canonical_text
      },
      codings: (entity.codings ?? []).map((coding) => ({
        system: SYSTEM_LABEL_BY_URI[coding.system] ?? coding.system,
        code: coding.code,
        display: coding.display,
        version: coding.release_version ?? undefined,
        confidence: coding.confidence >= 0.7 ? "high" : coding.confidence >= 0.5 ? "medium" : "low",
        status: "candidate"
      })),
      uncertainty: {
        reviewPriority: entity.review_priority === "high" ? "high" : reasons.length ? "needs-review" : "routine",
        reasons
      },
      confidence: topScore >= 0.85 ? "high" : topScore >= 0.6 ? "medium" : "low",
      explanation: "Extracted by the clinical_nlp engine (ADR-001)."
    };
  });
}

async function readJsonBody(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON." });
    return null;
  }
}

export function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

/**
 * C9: resolve the risk feature vector without silent zero-fill.
 * - present + finite -> used as-is
 * - a `*__missing` indicator absent -> defaults to 1 (treat as missing) and is
 *   recorded as coerced
 * - a value absent but its measurement's __missing indicator is set to 1 ->
 *   coerced to a neutral 0 (scoring substitutes the model center) and recorded
 * - a value absent with no missing-indicator signal -> required, reported
 */
export function resolveRiskFeatures(input, featureNames) {
  const indicatorByMeasure = {};
  for (const name of featureNames) {
    if (name.endsWith("__missing")) indicatorByMeasure[name.slice(0, -"__missing".length)] = name;
  }

  const features = {};
  const coerced = [];
  const missingRequired = [];

  const finiteOf = (name) => {
    const value = Number(input[name]);
    return Number.isFinite(value) ? value : null;
  };

  for (const name of featureNames) {
    const value = finiteOf(name);
    if (value !== null) {
      features[name] = value;
      continue;
    }
    if (name.endsWith("__missing")) {
      features[name] = 1;
      coerced.push({ feature: name, to: 1, reason: "missing-indicator-defaulted" });
      continue;
    }
    const measure = Object.keys(indicatorByMeasure)
      .filter((prefix) => name === prefix || name.startsWith(`${prefix}_`))
      .sort((a, b) => b.length - a.length)[0];
    const indicator = measure ? indicatorByMeasure[measure] : undefined;
    if (indicator && Number(input[indicator]) === 1) {
      features[name] = 0;
      coerced.push({ feature: name, to: 0, reason: `covered-by-${indicator}` });
    } else {
      missingRequired.push(name);
    }
  }

  return { features, coerced, missingRequired };
}

function scoreRiskFeatures(features, artifact) {
  const contributions = artifact.featureNames.map((feature) => {
    const normalizedValue = normalizeRiskFeature(feature, features, artifact.normalization[feature]);
    return {
      feature,
      contribution: normalizedValue * artifact.weights[feature],
      rawValue: features[feature]
    };
  });
  const logit = contributions.reduce((sum, item) => sum + item.contribution, artifact.intercept);
  const probability = Number(sigmoid(logit).toFixed(3));
  const band = probability >= artifact.thresholds.high ? "high" : probability >= artifact.thresholds.low ? "moderate" : "low";

  return {
    probability,
    band,
    decision: probability >= artifact.thresholds.decision ? "above-threshold" : "below-threshold",
    threshold: artifact.thresholds.decision,
    drivers: contributions
      .filter((item) => Math.abs(item.contribution) >= 0.08)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 5)
      .map((item) => ({
        feature: item.feature,
        contribution: Number(item.contribution.toFixed(3)),
        rawValue: item.rawValue
      }))
  };
}

function normalizeRiskFeature(feature, features, spec) {
  const value = getRiskModelFeatureValue(feature, features, spec?.center ?? 0);
  if (!Number.isFinite(value) || !Number.isFinite(spec?.scale) || spec.scale === 0) return 0;
  return (value - spec.center) / spec.scale;
}

function getRiskModelFeatureValue(feature, features, neutralValue) {
  if (feature === "heart_rate__mean" && features.heart_rate__missing === 1) return neutralValue;
  if ((feature === "bp_systolic__last" || feature === "bp_diastolic__last") && features.bp_missing === 1) return neutralValue;
  return features[feature];
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}
