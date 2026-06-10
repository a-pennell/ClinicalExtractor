import { describe, expect, it } from "vitest";
import { buildGatedExport, gateEntities, resolveEntityTier } from "./exportGates.mjs";

/**
 * Export gate tests (operating-point policy section 6): each tier x path.
 */

const entity = (type, assertion = "present", overrides = {}) => ({
  id: `${type}-1`,
  type,
  canonicalName: type,
  displayName: type,
  attributes: { assertion },
  ...overrides
});

const baseCtx = { acknowledgedTypes: new Set(), escalationFailed: false, interimStrict: true };

describe("resolveEntityTier", () => {
  it("blocks conflicting and unknown assertions regardless of type", () => {
    expect(resolveEntityTier(entity("vital", "conflicting"), baseCtx).tier).toBe("blocked");
    expect(resolveEntityTier(entity("score", "unknown"), baseCtx).tier).toBe("blocked");
  });

  it("flags vitals/scores under the interim rule (pass -> flagged)", () => {
    expect(resolveEntityTier(entity("vital"), baseCtx).tier).toBe("flagged");
    expect(resolveEntityTier(entity("score"), baseCtx).tier).toBe("flagged");
  });

  it("blocks problems/symptoms/procedures under the interim rule (flagged -> blocked)", () => {
    expect(resolveEntityTier(entity("problem"), baseCtx).tier).toBe("blocked");
    expect(resolveEntityTier(entity("symptom"), baseCtx).tier).toBe("blocked");
    expect(resolveEntityTier(entity("procedure"), baseCtx).tier).toBe("blocked");
  });

  it("blocks risk/med/allergy without reviewer acknowledgment", () => {
    for (const type of ["risk", "medication", "allergy"]) {
      expect(resolveEntityTier(entity(type), baseCtx).reason).toBe("reviewer-ack-required");
    }
  });

  it("lifts acknowledged risk/med/allergy to flagged", () => {
    const ctx = { ...baseCtx, acknowledgedTypes: new Set(["medication"]) };
    expect(resolveEntityTier(entity("medication"), ctx).tier).toBe("flagged");
    // an un-acknowledged sibling type stays blocked
    expect(resolveEntityTier(entity("risk"), ctx).tier).toBe("blocked");
  });

  it("caps escalation-failed notes at flagged minimum", () => {
    const ctx = { ...baseCtx, interimStrict: false, escalationFailed: true };
    expect(resolveEntityTier(entity("vital"), ctx).tier).toBe("flagged");
  });
});

describe("buildGatedExport", () => {
  const session = (entities, extra = {}) => ({ id: "s1", entities, acknowledgments: {}, ...extra });

  for (const type of ["json", "fhir", "clipboard"]) {
    it(`${type}: returns 409 with the blocked list and no document when anything is blocked`, () => {
      const result = buildGatedExport(session([entity("problem"), entity("vital")]), type);
      expect(result.status).toBe(409);
      expect(result.payload.error).toBe("export-blocked");
      expect(result.payload.blocked.map((b) => b.type)).toContain("problem");
      expect(result.payload.entities).toBeUndefined();
    });

    it(`${type}: serializes flagged entities with unreviewed status when nothing is blocked`, () => {
      const result = buildGatedExport(session([entity("vital"), entity("score")]), type);
      expect(result.status).toBe(200);
      if (type === "json") expect(result.payload.entities.every((e) => e.reviewStatus === "unreviewed")).toBe(true);
      if (type === "fhir") expect(result.payload.entry.every((e) => e.resource.verificationStatus === "unconfirmed")).toBe(true);
      if (type === "clipboard") expect(result.payload.text).toContain("unreviewed");
    });
  }

  it("serializes acknowledged medications (reviewer ack path)", () => {
    const acknowledged = session([entity("medication")], { acknowledgments: { medication: { reviewerId: "r1", at: "t" } } });
    const result = buildGatedExport(acknowledged, "json");
    expect(result.status).toBe(200);
    expect(result.payload.entities).toHaveLength(1);
  });
});

describe("gateEntities", () => {
  it("partitions serializable and blocked", () => {
    const { serializable, blocked } = gateEntities([entity("vital"), entity("problem")], baseCtx);
    expect(serializable).toHaveLength(1);
    expect(blocked).toHaveLength(1);
  });
});
