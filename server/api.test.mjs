import { describe, expect, it } from "vitest";
import { createApiHandler, toClientEntities } from "./api.mjs";

/**
 * ADR-001 acceptance criterion 3 (server side): the API renders engine
 * envelopes without performing clinical inference. A fake engine supplies the
 * envelope; the handler must only adapt it.
 */

function mockResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      Object.assign(this.headers, headers ?? {});
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : null;
    }
  };
}

function jsonRequest(method, body) {
  async function* iterate() {
    yield Buffer.from(JSON.stringify(body));
  }
  return Object.assign(iterate(), { method });
}

const sampleEnvelope = {
  schema_version: "engine-1",
  escalation_failed: false,
  mentions: [
    { text: "chest pain", entity_type: "symptom", start_char: 7, end_char: 17, assertion: "absent", confidence_score: 0.9 },
    { text: "chest pain", entity_type: "symptom", start_char: 31, end_char: 41, assertion: "present", confidence_score: 0.9 }
  ],
  entities: [
    {
      canonical_text: "chest pain",
      entity_type: "symptom",
      assertion: "conflicting",
      review_priority: "high",
      mention_indexes: [0, 1],
      codings: [{ system: "http://snomed.info/sct", code: "29857009", display: "Chest pain", release_version: null, confidence: 0.6 }],
      is_coded: false
    }
  ]
};

describe("toClientEntities (ADR-001 rendering adapter)", () => {
  it("maps the conflicting rollup to high review priority without re-deriving it", () => {
    const entities = toClientEntities(sampleEnvelope);
    expect(entities).toHaveLength(1);
    expect(entities[0].attributes.assertion).toBe("conflicting");
    expect(entities[0].uncertainty.reviewPriority).toBe("high");
    expect(entities[0].mentions).toHaveLength(2);
    expect(entities[0].codings[0].system).toBe("SNOMED-CT");
  });

  it("flags unpinned codings as needing a terminology candidate", () => {
    const entities = toClientEntities(sampleEnvelope);
    expect(entities[0].uncertainty.reasons.some((r) => /release-pinned/.test(r))).toBe(true);
  });
});

describe("POST /api/sessions/:id/extract", () => {
  it("returns engine entities and surfaces escalation_failed", async () => {
    const engine = { extract: async () => ({ ...sampleEnvelope, escalation_failed: true }), ping: async () => ({}) };
    const handler = createApiHandler({ engine, riskModelArtifact: { featureNames: [] }, sessions: new Map() });
    const response = mockResponse();

    await handler(jsonRequest("POST", { sourceText: "x" }), response, new URL("http://localhost/api/sessions/s1/extract"));

    expect(response.statusCode).toBe(200);
    expect(response.body.escalation_failed).toBe(true);
    expect(response.body.entities[0].attributes.assertion).toBe("conflicting");
  });

  it("returns 503 (not a partial result) when the engine is unavailable", async () => {
    const engine = {
      extract: async () => {
        throw Object.assign(new Error("engine-unavailable"), { code: "engine-unavailable" });
      },
      ping: async () => ({})
    };
    const handler = createApiHandler({ engine, riskModelArtifact: { featureNames: [] }, sessions: new Map() });
    const response = mockResponse();

    await handler(jsonRequest("POST", { sourceText: "x" }), response, new URL("http://localhost/api/sessions/s1/extract"));

    expect(response.statusCode).toBe(503);
    expect(response.body.error).toBe("extraction-engine-unavailable");
  });
});
