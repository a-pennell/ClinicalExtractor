# ADR-001: Python `clinical_nlp` Is the Single Extraction Engine

**Status:** Accepted · 2026-06-10
**Decision owner:** Andrew Pennell
**Supersedes:** implicit dual-pipeline architecture
**Audit references:** Q1, C1, C2, B6 (pre-review-audit.md, 2026-06-10)

## Context

The repo contains two parallel implementations of clinical extraction logic: the Python `clinical_nlp` package and the TypeScript `src/lib/clinical-extraction` browser pipeline. Negation, evaluation, abbreviation handling, and plausibility validation each exist twice, and the 2026-06-10 audit verified they already disagree:

- Python negation is sentence-scoped with termination cues and a hypothetical class; TS uses a fixed 36-character lookbehind with neither. Verified divergences: `"No fever but cough is present."` → TS asserts cough **absent**; `"No fever, chills, cough, vomiting, diarrhea, or headache."` → TS asserts headache **present**; `"Rule out asthma."` → TS asserts **present**.
- TS dedupe resolves contradicting mentions to a sticky **absent** (B6), the most clinically dangerous behavior found in the audit. The Python schema already keeps assertion at the mention level.
- Both stacks fail historical / family-history / conditional assertions (C2), so neither is "the good one" today — but only one should be fixed.

Maintaining both means every clinical-logic fix lands twice or diverges. Divergence in a clinical assertion engine is a patient-safety risk, not a code-style problem.

## Decision

1. **Python `clinical_nlp` becomes the only extraction engine.** All extraction, negation/assertion resolution, dedupe/rollup, normalization, and evaluation logic lives in Python.
2. **The engine is served behind `POST /api/sessions/:id/extract`** (the endpoint already stubbed in `server.mjs`). The server response envelope is the contract: mentions with source-text offsets, mention-level assertions, entity-level rollups with explicit `conflicting` status, codings from `clinical_nlp/normalization.py`, and review-priority metadata.
3. **The TS pipeline is demoted to rendering.** `src/lib/clinical-extraction` becomes a thin client: it renders server responses (highlighting, entity panels, review queue) and performs no clinical inference.
4. **TS clinical-logic modules are frozen, not deleted.** `negationRules.ts`, `dedupeEntities.ts`, the TS evaluation modules, and `detectLaterality()` get a deprecation header comment, are excluded from new feature work, and are removed only after the cutover acceptance suite passes. Their *tests* are not frozen — see below.
5. **The TS edge-case tests become the cutover acceptance suite.** Every `it.fails` case in `clinicalEdgeCases.test.ts` is ported to run against the Python engine via the API (or directly via pytest equivalents). Cutover is complete when the ported suite passes with no `fails`/`xfail` markers.

## Rationale for Python over TS

- **Semantics are ahead where it counts.** Sentence-scoped negation with termination cues and a hypothetical class is the correct foundation; the TS lookbehind is a false-positive *and* false-negative generator in a single rule (audit C1).
- **Schema is ahead.** Mention-level assertion (Python) is the correct substrate for B6's `conflicting` rollup; TS entity-level sticky-absent must be discarded regardless.
- **Evaluation is ahead.** `evaluation.py` (exact + partial span PRF, assertion accuracy) plus `scripts/run_eval.py` and the gold JSONL contract already exist in Python. The TS "Eval Lab" was shown to be circular (audit B4).
- **Server-side is the only viable PHI posture.** A browser-resident extraction engine forces clinical text into `localStorage`/IndexedDB (audit C7) and makes BAA-gated LLM escalation, audit logging, and model/prompt pinning (Q3 plan) impossible to enforce. One server-side engine puts every PHI touchpoint behind controls you own.
- **One engine, one eval.** The `--min-f1` CI gate is only meaningful if it gates the engine that ships.

The one asset the TS side is ahead on — `terminologyMappings.ts` (~1,100 lines of candidate codings) — is **migrated, not discarded**: it seeds `StaticTerminologyResolver` data in Python, with release-version pinning added per audit B5.

## Consequences

**Positive:** single source of clinical truth; B6/C1/C2 fixed once; the eval harness gates the production path; PHI never needs to persist client-side for extraction to work; LLM escalation (when enabled) runs entirely server-side under Q3 controls.

**Negative / accepted costs:** extraction now requires a round trip (mitigate with per-note latency budget ≤ 1.5 s p95 for deterministic extraction; the UI already has async session flows); the demo no longer works fully offline (accepted — offline clinical inference was never a real requirement, it was an artifact of where the prototype started); Python deployment becomes load-bearing (requires C6 lockfile work and CI before cutover).

**Explicit non-goals:** porting TS negation behavior anywhere (it is wrong; the Python resolver's semantics win on every divergence); maintaining feature parity in the frozen TS modules during the transition.

## Acceptance criteria for cutover

1. `POST /api/sessions/:id/extract` returns the full envelope for all six gold seed notes, spans validated against source text.
2. Ported edge-case suite green (no `fails`/`xfail`): negation termination cues, long denial lists, rule-out, historical, family-history, conditional, contradicting-mention `conflicting` rollup.
3. UI renders exclusively from server responses; grep confirms no imports of frozen TS inference modules from application code.
4. CI runs pytest + vitest + `run_eval.py --min-f1` on every PR (audit C6 gap).
5. `data/gold/seed_notes.jsonl` eval shows no per-type F1 regression vs. the pre-cutover Python baseline.

## Revisit triggers

Re-open this decision only if: extraction latency p95 exceeds 1.5 s and cannot be optimized server-side; or a hard requirement emerges for fully offline operation with real PHI (which would itself require a far larger security redesign than a TS engine).
