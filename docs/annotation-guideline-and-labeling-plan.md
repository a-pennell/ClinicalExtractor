# Annotation Guideline & Labeling Plan — Clinical Entity Extraction Gold Corpus

**Status:** v0.9 — calibrate on the 50-note round, then freeze as v1.0
**Adapted from:** i2b2/VA 2010 concept & assertion task, modified for this repo's `EntityType` / `AssertionStatus` enums and outpatient (primary care, mental health, PT/SLP) note types.
**Format contract:** JSONL per `scripts/run_eval.py` docstring — one note per line: `note_id`, `text`, and `mentions[]` of `{start, end, text, entity_type, assertion}`. `text[start:end]` must equal `mention.text` exactly (the harness validates this on load).

---

## Part A — Annotation guideline

### A1. What to annotate (entity types)

Annotate every mention of: **problem/condition, symptom, medication, procedure, allergy, vital, score, risk/SI** (use the repo's `EntityType` values verbatim). Annotate at the **mention** level — every occurrence, including repeats in copy-forwarded text. Dedupe is the system's job, not the annotator's; repeated mentions are exactly the signal the `conflicting` rollup needs.

### A2. Span rules

1. **Minimal clinically-complete span.** Include words that change clinical identity; exclude determiners, possessives, and assertion cues.
   - `"severe crushing chest pain"` → annotate `crushing chest pain` (severity yes if it names the finding — see 3; `severe` alone is a modifier: exclude). When in doubt: would the entity mean something different without the word? Keep it. Otherwise drop it.
   - `"his diabetes"` → `diabetes`. `"denies chest pain"` → `chest pain` (the cue `denies` drives assertion, not span).
2. **Anatomical anchors and laterality stay in-span**: `left knee pain`, `R shoulder impingement`. (This is the gold the C8 laterality fix will be measured against — never annotate laterality from a bare verb like "left the clinic".)
3. **Multi-word drug mentions**: drug + strength + form is one span when contiguous (`sertraline 50 mg tablet`); dosing instructions (`take one daily`) are out.
4. **Abbreviations**: annotate the abbreviation as written (`SOB`, `MI`, `HTN`); entity type per resolved meaning in context. If genuinely unresolvable in context, skip it and log to the question sheet (A5).
5. **List constructions**: each item is its own mention. `"No fever, chills, or cough"` → three mentions, each `absent`.
6. **Discontinuous mentions** (`"pain in the left and right knees"`): annotate the contiguous head (`right knees` span as written) and log to the question sheet; v1 schema is contiguous-spans-only.
7. **Misspellings** (`diabetis`, `hypertention`): annotate exactly as written, correct `entity_type`. Gold must contain these — the system's zero tolerance for misspellings (audit C8) only shows up in recall if the corpus includes them.

### A3. Assertion classes (the heart of this guideline)

Use the repo's `AssertionStatus` enum. Decision order — apply the **first** matching rule:

1. **FAMILY_HISTORY** — experienced by someone other than the patient. Cues: `mother/father/brother has…`, `FHx:`, `family history of…`. *Trap:* `"mother smothered"` contains the substring "mother" — assertion is about the relation actually present in the dependency sense, not a substring (this is gold for the audit's TriagePolicy substring bug).
2. **CONDITIONAL** — occurs only under a stated circumstance: `"pain with exertion"`, `"dizziness when standing"`. The trigger circumstance is real and recurring.
3. **HYPOTHETICAL** — may occur in the future / instructional: `"if chest pain recurs"`, `"educated on warning signs of stroke"`, `"return precautions for fever"`. Patient does **not** currently have it.
4. **HISTORICAL** — occurred in the past, not described as currently active: `"history of MI"`, `"h/o asthma"`, `"status post CABG"` (the procedure is historical), `"PMH:"` items, `"resolved"`. *Boundary:* chronic conditions under active management (`"history of hypertension, on lisinopril"`) → **PRESENT** — "history of" in chronic-disease context means longstanding, not resolved. This is the highest-disagreement rule; it gets the most worked examples in calibration.
5. **POSSIBLE** — uncertainty about whether it exists *now*: `"rule out PE"`, `"possible pneumonia"`, `"cannot exclude fracture"`, `"likely viral"`. (`"Rule out asthma"` is POSSIBLE, never PRESENT — direct gold against the C1 failure.)
6. **ABSENT** — explicitly negated: `"denies"`, `"no"`, `"without"`, `"negative for"`. Negation scope ends at termination cues (`but`, `however`, `except`, new sentence): in `"No fever but cough is present"`, fever is ABSENT, cough is PRESENT.
7. **PRESENT** — default only after 1–6 fail.

**Contradictions across the note are annotated as-is** — `"denies chest pain"` (ABSENT) early and `"reports chest pain"` (PRESENT) later are two mentions with different assertions. Do not reconcile; the entity-level `conflicting` status is computed, not annotated.

### A4. Worked examples (one per note domain)

**Primary care:** `"Pt c/o intermittent palpitations x2 weeks. Denies CP, SOB, syncope. PMH: HTN, T2DM. FHx: father with MI at 54. If symptoms worsen, will refer to cardiology."`
→ `palpitations` symptom/PRESENT (CONDITIONAL is wrong — "intermittent" is frequency, not a trigger circumstance) · `CP` symptom/ABSENT · `SOB` symptom/ABSENT · `syncope` symptom/ABSENT · `HTN` problem/PRESENT (PMH chronic-active) · `T2DM` problem/PRESENT · `MI` problem/FAMILY_HISTORY · `symptoms worsen` — not an entity; `refer to cardiology` procedure/HYPOTHETICAL.

**Mental health:** `"PHQ-9 today 14. Reports passive SI without plan or intent; denies HI. Hx of MDD, single episode 2019, in remission until last month. Started sertraline 50 mg."`
→ `PHQ-9 … 14` score/PRESENT · `SI` risk/PRESENT (passive SI is present SI; "without plan or intent" are attributes, not negation of the SI itself) · `HI` risk/ABSENT · `MDD` problem/PRESENT (remission ended — currently active) · `sertraline 50 mg` medication/PRESENT.

**PT/SLP:** `"s/p R TKA 6 wks ago. Pain 4/10 with stairs, 1/10 at rest. No erythema or warmth at incision. Pt left the clinic ambulating independently."`
→ `R TKA` procedure/HISTORICAL · `Pain … with stairs` symptom/CONDITIONAL · `Pain … at rest` symptom/PRESENT · `erythema` symptom/ABSENT · `warmth` symptom/ABSENT · final sentence: **no laterality, no entity** from "left" (verb) — gold against C8.

### A5. Process hygiene

Annotators keep a shared **question sheet** (note_id, span, question). Adjudicator answers weekly; every answered question becomes a new guideline example. No annotator invents a rule mid-corpus.

---

## Part B — Labeling plan

### B1. Corpus

**Target: 250 notes** (range 200–300), stratified: 35% primary care, 30% mental health, 25% PT/SLP, 10% mixed/other. Mandatory hard-case quotas across the corpus — each appearing in ≥ 10% of notes: denial lists ≥ 6 items; copy-forward duplicate paragraphs; inline narrative history/FHx (not header-cued); conditionals and hypotheticals; misspellings; ambiguous abbreviations (each sense represented).

**Sources:** (1) synthetic generation seeded from `data/gold/seed_notes.jsonl` style, with a generation prompt bank checked into the repo for reproducibility; (2) de-identified real notes **only** under documented Safe Harbor or Expert Determination, reviewed before entering the repo — gold files are committed, so the bar is "publishable", not "internal". When in doubt, synthetic.

### B2. Phases

| Phase | Notes | Who | Output | Gate to next phase |
|---|---|---|---|---|
| 0. Guideline v0.9 | — | author | this doc + 10 fully-worked notes | self-consistency pass |
| 1. Calibration | 50, dual-annotated blind | 2 annotators | IAA report | span-level F1 ≥ 0.85 between annotators; Cohen's κ ≥ 0.70 on assertion (matched spans). Below gate → adjudicate, amend guideline, re-run 25 fresh notes. |
| 2. Adjudication | the 50 | adjudicator | gold v1 + guideline v1.0 (frozen) | all disagreements resolved with written rationale |
| 3. Production | 200 single-pass + 15% (30) dual overlap | 2 annotators | gold v2 | rolling IAA on overlap stays ≥ phase-1 gate; two consecutive weekly drops → stop, recalibrate |
| 4. Splits | — | author | `data/gold/{dev,test}.jsonl` | **test split (40%) frozen day one, stratified by domain & hard-case quota.** Dev (60%) drives all dictionary/rule work. Test is touched only at release tags. |

### B3. Tooling

Label Studio (or INCEpTION) with the entity/assertion config checked into `annotation/`; exporter script → harness JSONL with span-text validation at convert time (fail loud, not at eval time). Annotation UI never leaves the local machine if real de-identified notes are in play.

### B4. CI integration (closes the loop with audit B4/C6)

- `run_eval.py --split dev --min-f1 <current_dev_f1 − 0.02>` blocks merge.
- Per-type recall for problem/symptom/medication/procedure is the dashboard headline until each clears 0.60 — the audit's 0.00s are the deficit this entire plan exists to fix, and dictionary/rule expansion is driven exclusively by dev-split miss analysis, never by eyeballing.
- Empty-denominator types report `n/a` (C3), so progress is never masked by vacuous 1.000 precision.

### B5. Budget reality check

At ~12 min/note annotation + overhead: calibration ≈ 25 annotator-hours, production ≈ 55, adjudication/management ≈ 15. **~95 hours total** to a real evaluation corpus. This is the single highest-leverage 95 hours in the project: nothing about recall can be claimed, improved, or gated without it.
