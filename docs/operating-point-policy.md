# Operating-Point Policy: Clinical Entity Extraction

**Status:** v1 draft for adoption · 2026-06-10
**Answers:** Audit Q2 — "Review-gated or autonomous, and for which consumers?"
**Depends on:** ADR-001 (Python engine), gold corpus (audit B4 plan)

## 1. System posture

**The system is review-gated. It is not autonomous for any consumer.** No extracted entity reaches a problem list, billing pathway, risk model, FHIR export, or clipboard export without passing the review policy below. Default-PRESENT-on-unknown and uncalibrated confidence (audit C2, C3) are acceptable *only* under this posture; any future relaxation requires re-ratifying this document against calibrated metrics.

Three review states (matching `reviewPriority` / reviewer-state in the UI):

- **`blocked`** — entity cannot be exported in any form until a human reviewer explicitly acknowledges it.
- **`flagged`** — entity exports, but is visually marked unconfirmed and carries `"review_status": "unreviewed"` in machine-readable output (FHIR: `verificationStatus: unconfirmed`).
- **`pass`** — entity exports normally, still labeled as machine-extracted provenance.

## 2. Per-entity-type policy

Targets are measured on the held-out test split (annotation plan §4) with partial span matching. Until the corpus reaches ≥ 200 notes and confidence is calibrated (§4), **every type operates one row stricter than listed** — i.e., today, everything below `pass` semantics behaves as `blocked`.

| Entity type | Target precision | Target recall | Abstain below (calibrated conf.) | Export policy | Rationale |
|---|---|---|---|---|---|
| Risk / SI | ≥ 0.90 | **≥ 0.97** | Never abstain — always emit, always `blocked` | **Never unreviewed.** No threshold makes SI auto-exportable. | Recall-dominant: a missed SI mention is the worst error the system can make. False positives cost reviewer seconds. |
| Medications | **≥ 0.97** | ≥ 0.90 | 0.80 | `blocked` until reviewed | Precision-dominant: a hallucinated or wrong-drug entity on a med list is an active hazard. |
| Allergies | **≥ 0.97** | ≥ 0.95 | 0.80 | `blocked` until reviewed | Both directions dangerous; missed allergy → exposure, false allergy → denied effective treatment. |
| Problems / conditions | ≥ 0.90 | ≥ 0.85 | 0.70 | `flagged` | Feeds problem lists; errors are visible and correctable in review UI. |
| Symptoms | ≥ 0.85 | ≥ 0.85 | 0.65 | `flagged` | Lower downstream stakes; narrative context preserved. |
| Procedures | ≥ 0.90 | ≥ 0.85 | 0.70 | `flagged` | Billing-adjacent once coded; revisit to `blocked` if CPT mapping is added. |
| Vitals / scores | ≥ 0.98 | ≥ 0.95 | n/a (deterministic) | `pass`, with plausibility validation | Regex-deterministic; plausibility validator is the real gate. Out-of-range values → `flagged`, not silently emitted or dropped. |

## 3. Assertion and conflict policy

- **Assertion lives at the mention level** (per ADR-001 and the existing Python schema). Entity rollup computes an entity-level assertion only when all mentions agree.
- **Contradicting mentions → entity assertion `conflicting` → `blocked`.** This is the B6 fix: "denies chest pain" + "reports chest pain" must surface as a conflict demanding human resolution, never resolve silently in either direction. Copy-forward makes this the common case.
- **Historical, family-history, conditional, hypothetical assertions** (audit C2) are first-class. An entity whose only mentions are family-history or hypothetical never populates an active problem list; it exports only inside its assertion-typed section. Until the C2 triggers are implemented and passing their xfail tests, any note containing trigger language (per the TriagePolicy lexicon) marks all `flagged`-tier entities in that note as `blocked`.
- **Unknown assertion ≠ present.** If the resolver cannot classify, assertion is `unknown` and the entity is `blocked`. Default-PRESENT is abolished with the C2 work.

## 4. Confidence: calibration before authority

Current confidence values (constant 0.92 regex, string-length heuristics) are **uncalibrated and carry no routing authority** beyond the conservative defaults above. Plan:

1. After the 50-note calibration round (annotation plan), bin predictions by reported confidence and compute observed precision per bin (reliability diagram, per entity type).
2. Fit per-type calibration (isotonic or Platt — pick by Brier score on dev).
3. Replace raw confidences with calibrated ones in the API envelope; recompute the abstain thresholds in §2 so "0.80" means *observed* ≥ 0.80 precision.
4. `TriagePolicy.min_confidence_for_skip` consumes calibrated values only; until then, hybrid-mode skip routing is disabled.
5. Empty-denominator metrics report `n/a`, never 1.000 (audit C3).

## 5. Abstention and failure semantics

- **Below abstain threshold:** the system emits a **review task** ("possible medication near line 14, confidence 0.61") rather than an entity. Abstention is visible work, not silence.
- **LLM escalation failure (B2 envelope):** notes where escalation failed are stamped `escalation_failed: true` and every entity in the note is capped at `flagged` minimum, with the note itself queued for review. Provider outages must surface as review load, never as silently reduced recall.
- **Span-remap drops (B1 fix):** dropped-mention count is telemetry; any note with ≥ 1 dropped LLM mention is queued for review.

## 6. Export gates (implementation contract)

Every export path — JSON, FHIR, clipboard (`DocumentOutputPanel`) — enforces:

1. No `blocked` entity serializes. Attempted export with blocked entities returns the blocked list, not partial output the user might mistake for complete.
2. `flagged` entities serialize with explicit unreviewed status (above).
3. Risk/SI, medications, allergies additionally require a recorded reviewer acknowledgment (who/when) in the session before *any* serialization of those types.
4. The gate is server-side (post-ADR-001); the UI mirror of the gate is convenience, not enforcement.

## 7. Review cadence

Re-ratify this document when: the gold corpus first reaches 200 notes; confidence calibration lands; hybrid LLM mode is enabled (triggers Q3 controls); or any consumer beyond the review UI (billing, problem-list sync, risk models) is proposed — each new consumer gets its own row-level review of this table before integration.
