import { describe, expect, it } from "vitest";
import { createApiHandler } from "./api.mjs";

/**
 * Export-gate enforcement through the HTTP API (operating-point policy 6.4:
 * the gate is server-side, not just a UI affordance).
 */

function mockResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    writeHead(s, h) {
      this.statusCode = s;
      Object.assign(this.headers, h ?? {});
    },
    end(p) {
      this.body = p ? JSON.parse(p) : null;
    }
  };
}

function jsonRequest(method, body) {
  async function* iterate() {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body));
  }
  return Object.assign(iterate(), { method });
}

function setup(entities, extra = {}) {
  const sessions = new Map([["s1", { id: "s1", entities, acknowledgments: {}, ...extra }]]);
  const handler = createApiHandler({ engine: { ping: async () => ({}) }, riskModelArtifact: { featureNames: [] }, sessions });
  return { handler, sessions };
}

const ent = (type, assertion = "present") => ({ id: `${type}-1`, type, canonicalName: type, displayName: type, attributes: { assertion } });

describe("GET /api/sessions/:id/export/:type", () => {
  it("blocks export (409) when a session has blocked entities", async () => {
    const { handler } = setup([ent("problem"), ent("vital")]);
    const response = mockResponse();
    await handler(jsonRequest("GET"), response, new URL("http://localhost/api/sessions/s1/export/json"));
    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe("export-blocked");
  });

  it("serializes (200) when only flagged-eligible entities remain", async () => {
    const { handler } = setup([ent("vital"), ent("score")]);
    const response = mockResponse();
    await handler(jsonRequest("GET"), response, new URL("http://localhost/api/sessions/s1/export/fhir"));
    expect(response.statusCode).toBe(200);
    expect(response.body.entry.every((e) => e.resource.verificationStatus === "unconfirmed")).toBe(true);
  });
});

describe("POST /api/sessions/:id/acknowledge", () => {
  it("records reviewer id + timestamp and unblocks the acknowledged type", async () => {
    const { handler, sessions } = setup([ent("medication")]);

    const ackResponse = mockResponse();
    await handler(
      jsonRequest("POST", { reviewerId: "dr-smith", types: ["medication"] }),
      ackResponse,
      new URL("http://localhost/api/sessions/s1/acknowledge")
    );
    expect(ackResponse.statusCode).toBe(200);
    expect(sessions.get("s1").acknowledgments.medication.reviewerId).toBe("dr-smith");
    expect(typeof sessions.get("s1").acknowledgments.medication.at).toBe("string");

    const exportResponse = mockResponse();
    await handler(jsonRequest("GET"), exportResponse, new URL("http://localhost/api/sessions/s1/export/json"));
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.body.entities).toHaveLength(1);
  });

  it("rejects acknowledgment without a reviewer id", async () => {
    const { handler } = setup([ent("medication")]);
    const response = mockResponse();
    await handler(
      jsonRequest("POST", { types: ["medication"] }),
      response,
      new URL("http://localhost/api/sessions/s1/acknowledge")
    );
    expect(response.statusCode).toBe(400);
  });
});
