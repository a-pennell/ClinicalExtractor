/**
 * Server-side export gates (operating-point policy sections 2, 3, 6).
 *
 * Every export path (JSON, FHIR, clipboard) runs entities through this gate
 * before serialization. The gate is the enforcement point; the UI mirror is
 * convenience only (policy section 6.4).
 *
 * Tiers: `blocked` (never serialized), `flagged` (serialized, marked
 * unreviewed), `pass` (serialized normally — not reachable today, see interim
 * rule). Policy section 2 interim rule: until the gold corpus reaches 200
 * notes and confidence is calibrated, every type runs one row stricter, so
 * `pass` collapses to `flagged` and `flagged` collapses to `blocked`. A
 * recorded reviewer acknowledgment reflects human review and lifts the
 * ack-required types to their reviewed tier.
 */

export const ACK_REQUIRED_TYPES = new Set(["risk", "medication", "allergy"]);
const PASS_TYPES = new Set(["vital", "score"]);

/**
 * Resolve the export tier for one entity.
 * @param {object} entity client entity ({ type, attributes.assertion })
 * @param {object} ctx { acknowledgedTypes:Set, escalationFailed:boolean, interimStrict:boolean }
 */
export function resolveEntityTier(entity, ctx) {
  const assertion = entity.attributes?.assertion;
  // Policy section 3: contradictions and unresolvable assertions are always blocked.
  if (assertion === "conflicting") return { tier: "blocked", reason: "conflicting-assertion" };
  if (assertion === "unknown") return { tier: "blocked", reason: "unknown-assertion" };

  const type = entity.type;
  const ackRequired = ACK_REQUIRED_TYPES.has(type);
  const acknowledged = ackRequired && ctx.acknowledgedTypes.has(type);

  // Policy section 6.3: risk/SI, medications, allergies need recorded ack.
  if (ackRequired && !acknowledged) {
    return { tier: "blocked", reason: "reviewer-ack-required" };
  }

  let tier = PASS_TYPES.has(type) ? "pass" : "flagged";

  // Interim strictness (policy section 2). Human-acknowledged ack-required
  // types are exempt: the ack IS the review the interim rule is conservative about.
  if (ctx.interimStrict && !acknowledged) {
    tier = tier === "pass" ? "flagged" : "blocked";
  }

  // Policy section 5 / audit B2: a degraded note caps every entity at flagged.
  if (ctx.escalationFailed && tier === "pass") tier = "flagged";

  return { tier, reason: tier === "flagged" ? "unreviewed" : "ok" };
}

/**
 * Partition entities into serializable vs blocked, tagging serializable ones
 * with review status.
 */
export function gateEntities(entities, ctx) {
  const serializable = [];
  const blocked = [];
  for (const entity of entities) {
    const { tier, reason } = resolveEntityTier(entity, ctx);
    if (tier === "blocked") {
      blocked.push({ id: entity.id, type: entity.type, canonicalName: entity.canonicalName, reason });
    } else {
      serializable.push({ entity, reviewStatus: tier === "flagged" ? "unreviewed" : "reviewed" });
    }
  }
  return { serializable, blocked };
}

/**
 * Build a gated export payload for a session.
 * Policy section 6.1: if ANY entity is blocked, return the blocked list and NO
 * partial document — the caller must never mistake partial output for complete.
 */
export function buildGatedExport(session, exportType, { interimStrict = true } = {}) {
  const entities = session.entities ?? [];
  const acknowledgedTypes = new Set(Object.keys(session.acknowledgments ?? {}));
  const ctx = {
    acknowledgedTypes,
    escalationFailed: session.escalation_failed === true,
    interimStrict
  };

  const { serializable, blocked } = gateEntities(entities, ctx);
  if (blocked.length > 0) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: "export-blocked",
        message: "Blocked entities must be resolved or acknowledged before export; no partial output is emitted.",
        blocked,
        exportType
      }
    };
  }

  return { ok: true, status: 200, payload: serializeExport(exportType, serializable, session) };
}

function serializeExport(exportType, serializable, session) {
  if (exportType === "fhir") {
    return {
      exportType,
      resourceType: "Bundle",
      type: "collection",
      entry: serializable.map(({ entity, reviewStatus }) => ({
        resource: {
          resourceType: fhirResourceType(entity.type),
          code: { text: entity.canonicalName },
          verificationStatus: reviewStatus === "unreviewed" ? "unconfirmed" : "confirmed",
          provenance: "machine-extracted"
        }
      }))
    };
  }
  if (exportType === "clipboard") {
    return {
      exportType,
      text: serializable
        .map(({ entity, reviewStatus }) => `${entity.displayName} (${entity.type}; ${reviewStatus})`)
        .join("\n")
    };
  }
  // default: json
  return {
    exportType: "json",
    schemaVersion: "prototype-1",
    sessionId: session.id,
    entities: serializable.map(({ entity, reviewStatus }) => ({ ...entity, reviewStatus }))
  };
}

function fhirResourceType(entityType) {
  if (entityType === "medication") return "MedicationStatement";
  if (entityType === "allergy") return "AllergyIntolerance";
  if (entityType === "vital" || entityType === "score") return "Observation";
  return "Condition";
}
