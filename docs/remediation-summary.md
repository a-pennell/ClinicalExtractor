# Remediation Summary (PR body)

Implements the remediation plan in `docs/pre-review-audit.md` under the three
governing decisions: ADR-001 (Python engine is the single extraction path),
the operating-point policy (review-gated, never autonomous), and the
annotation guideline/labeling plan.

## Verification (all green)

- **pytest**: 50 passed, **0 xfail** (the 5 audit C2 xfails flipped to passing regression guards).
- **vitest**: 106 passed across 19 files, **0 `it.fails`** (audit gap cases flipped or superseded by the Python acceptance suite).
- **ruff** (pinned 0.15.16): clean. **eslint**: clean. **tsc -b**: clean.
- **Gold eval gate**: `run_eval.py --min-f1 0.39` passes (current partial-F1 0.414).
- Single entrypoint `./run_tests.sh` mirrors `.github/workflows/ci.yml`.

## ADR-001 acceptance criteria

1. ✅ `POST /api/sessions/:id/extract` returns the full envelope for all 6 gold notes, spans validated against source (`tests/test_engine_acceptance.py`).
2. ✅ Ported edge-case suite green, no `fails`/`xfail` (negation, termination cues, rule-out, historical, family-history, conditional, B6 conflict rollup).
3. ✅ UI renders from server responses (`extractionClient`); frozen inference modules blocked from app imports by eslint `no-restricted-imports` + `server/frozenModules.test.mjs`.
4. ✅ CI runs pinned ruff + pytest + eslint + tsc + vitest + `run_eval --min-f1` on every PR.
5. ✅ No per-type F1 regression vs pre-cutover baseline (below).

## Eval baseline (criterion 5)

Extraction in NLP mode is unchanged by this work (only assertion scoping,
rollup, normalization, and serving changed), so pre- and post-cutover numbers
are identical. Empty-denominator types now report `n/a` instead of a vacuous
1.000 (audit C3).

| Metric | Pre-cutover | Post-cutover |
|---|---|---|
| Overall partial P / R / F1 | 1.000 / 0.261 / 0.414 | 1.000 / 0.261 / 0.414 |
| vital / score / severity / risk F1 | 1.000 each | 1.000 each |
| problem / symptom / medication / procedure | recall 0.000 (P, F1 = n/a) | recall 0.000 (P, F1 = n/a) |

The 0.000-recall types remain the headline deficit; closing them is gated on
the labeling plan (dictionary/lexicon expansion driven by dev-split miss
analysis, explicitly out of scope for this PR).

## Audit-item status map

### Blockers
- **B1** (LLM offset corruption) — **previously fixed** (audit pass); preserved untouched, now also exercised end-to-end in `test_engine_acceptance`.
- **B2** (LLM failure discards NLP results) — **previously fixed**; this PR adds the `ExtractionOutcome`/`escalation_failed` envelope surfacing degradation to callers and export gates (resolves the open TODO).
- **B3** (wildcard CORS PHI path) — **previously fixed**; preserved in `server/api.mjs`.
- **B4** (no gold eval loop) — **fixed in this work**: harness wired into CI with a regression gate; per-assertion-class reporting added.
- **B5** (no normalization) — **fixed in this work**: `clinical_nlp/normalization.py` + migrated 108 codings/86 names with `release_version` pinning and `is_coded` flags.
- **B6** (sticky-absent on contradiction) — **fixed in this work**: `CONFLICTING` status + `clinical_nlp/rollup.py`; TS surgical patch; mention-level assertions preserved.
- **B7** (PHI in exception messages) — **previously fixed**; pattern reused across all new code (engine errors are codes only).

### Concerns
- **C1** (two divergent pipelines) — **fixed in this work**: ADR-001 cutover; Python is the engine, TS demoted to rendering and frozen.
- **C2** (historical/family/conditional are schema fiction) — **fixed in this work**: guideline-A3 decision order in the resolver; `CONDITIONAL` added; default-PRESENT abolished (→ `UNKNOWN`); boundary-aware triggers; TriagePolicy substring bug fixed.
- **C3** (empty denominators report 1.000) — **fixed in this work**: `safe_ratio` → `n/a`.
- **C4** (never abstains; HITL gates nothing) — **fixed in this work**: server-side export gates on every path; abstention via `UNKNOWN`/blocked tiers; reviewer acknowledgment required for risk/SI, meds, allergies.
- **C5** (LLM drift invisible) — **deferred with reason**: documented in ADR-001/operating-point as the Q3 plan; the B2 envelope and frozen prompt are prerequisites now in place. Model/prompt pinning + nightly golden-set is gated on enabling hybrid mode, which this PR does not do.
- **C6** (reproducibility half-done) — **fixed in this work**: ruff pinned + `requirements-dev.lock` + CI + `run_tests.sh`. (mypy/coverage drift noted; not in the CI spec, left out of the gate.)
- **C7** (PHI at rest in browser) — **partially addressed / deferred**: extraction no longer requires client-side persistence (engine path); encrypt-at-rest / TTL for the legacy localStorage/IndexedDB cache is deferred with the frozen TS surface. Server-side PHI posture (B3, engine stderr discarded) is closed.
- **C8** (laterality from a bare verb) — **fixed in this work**: anatomical-anchor requirement; `it.fails` flipped + positive case.
- **C9** (risk API silent zero-fill) — **fixed in this work**: `resolveRiskFeatures` rejects required-missing (400), coerces only `__missing`-covered features, echoes `coercedFeatures`.

### Nitpicks
- Dead `isSymbolTerm` branch — **fixed**. `attachDisambiguation` cross-entity mis-attachment — **fixed**. `merge_mentions` near-duplicate spans — **fixed** (overlap + text equality). `\bSI\b` context guard — **fixed** (downgrade+flag, never suppress). `dist/` committed — **fixed** (removed + gitignored). Untested regex spaghetti / coupling — **addressed** by the engine extraction (`server/api.mjs` split out for testability).

## Open / deferred (tracked, not silently dropped)

- Per-type recall for problem/symptom/medication/procedure (0.000) — gated on the labeling plan; dictionary expansion explicitly out of scope.
- Misspelling/fuzzy tolerance — same gate; current behavior pinned by a documented regression test.
- LLM drift controls (C5) and client-side PHI-at-rest (C7) — deferred with written rationale above; neither is on the active (NLP-mode) path this PR ships.
- mypy/coverage toolchain drift — pre-existing, outside the C6 (ruff/lockfile) scope; no new errors introduced by this work.
