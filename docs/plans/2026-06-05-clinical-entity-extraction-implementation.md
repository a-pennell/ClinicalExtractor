# Implementation Plan: Clinical Entity Extraction Prototype

## Overview

Build a lo-fi local clinical entity extraction prototype for primary care, mental health, physical therapy, and mixed clinical notes. The prototype supports typed or pasted text, local extraction, grouped entity review, highlighted source spans, and entity details.

## Tasks

### Batch 1: Setup

- [x] T001: Create Vite React TypeScript scaffold.
- [x] T002: Add npm scripts and config.
- [x] T003: Add `.gitignore`.

### Batch 2: Core Extraction

- [x] T004: Define clinical entity model.
- [x] T005: Add dictionaries and specialty profiles.
- [x] T006: Add regex value detectors.
- [x] T007: Add negation and ordered-context handling.
- [x] T008: Add dedupe logic.

### Batch 3: Prototype UI

- [x] T009: Build text input, specialty selector, and example loading.
- [x] T010: Build highlighted source span renderer.
- [x] T011: Build grouped entity panel and cards.
- [x] T012: Build entity detail panel.

### Batch 4: Verification

- [x] T013: Add extraction tests.
- [x] T014: Run test suite.
- [x] T015: Run production build.
- [x] T016: Start local dev server.

### Batch 5: Standards Preview

- [x] T017: Add terminology candidate model.
- [x] T018: Add starter local ICD-10-CM, SNOMED CT, LOINC, and RxNorm mappings.
- [x] T019: Add per-entity FHIR preview mapper.
- [x] T020: Display codes and FHIR preview in the detail panel.
- [x] T021: Add standards-layer regression tests.

### Batch 6: Coding Review

- [x] T022: Add reviewer controls to select, reject, or reset candidate codings.
- [x] T023: Track coding review state in the prototype entity state.
- [x] T024: Prefer selected codings and omit rejected codings in FHIR preview generation.
- [x] T025: Add UI and FHIR preview regression tests for adjudicated codings.

### Batch 7: Vital Signs

- [x] T026: Add local extraction for BP, HR, RR, SpO2, temperature, and weight shorthand.
- [x] T027: Add LOINC candidates for vital signs.
- [x] T028: Generate blood pressure FHIR previews with systolic and diastolic components.
- [x] T029: Add regression tests for vital signs and BP components.

### Batch 8: Entity Review UX

- [x] T030: Add entity review state to the model.
- [x] T031: Add detail-panel edit controls for entity fields and reviewer notes.
- [x] T032: Add mark-reviewed and delete actions.
- [x] T033: Add manual entity creation from selected source text.
- [x] T034: Surface review status in cards and top summary.
- [x] T035: Add UI regression tests for review workflows.

### Batch 9: Document-Level Output

- [x] T036: Add extraction session JSON builder.
- [x] T037: Add document-level FHIR Bundle preview builder.
- [x] T038: Add document output panel with summary counts and export actions.
- [x] T039: Add regression tests for session JSON, FHIR Bundle, and output panel.

### Batch 10: Allergies & Medication Sigs

- [x] T040: Add medication sig extraction for dose, route, frequency, PRN, and indication.
- [x] T041: Normalize medication entities by medication name.
- [x] T042: Add starter medication coverage and RxNorm candidates for common meds.
- [x] T043: Add allergy and no-known-allergy shorthand extraction.
- [x] T044: Generate FHIR AllergyIntolerance previews.
- [x] T045: Add regression tests for allergy and medication sig behavior.

### Batch 11: Terminology Abstraction & Clinical Coverage

- [x] T046: Add swappable terminology lookup abstraction around local candidate coding mappings.
- [x] T047: Add expanded lab-result coverage for CBC, Hgb, WBC, Plt, TSH, Cr, eGFR, LDL, HDL, TG, and total cholesterol.
- [x] T048: Add social and family history extraction for tobacco, alcohol, substance use, and family-history statements.
- [x] T049: Add imaging, referral, and procedure extraction with modality, body-site, planned, and ordered attributes.
- [x] T050: Add physical therapy and mental-health coverage for gait abnormality, impaired balance, fall risk, safety plan, panic attacks, and mania/hypomania.
- [x] T051: Add starter codings for expanded labs, social history, family history, PT findings, colonoscopy, and modality-based imaging.
- [x] T052: Preserve clinical acronyms in extracted display names.
- [x] T053: Add regression tests for the terminology abstraction and expanded coverage.

### Batch 12: Section Context, Relations, Evaluation & Persistence

- [x] T054: Add clinical section detection and mention-level section annotation.
- [x] T055: Use section context for starter assertion and temporality hints.
- [x] T056: Add inferred relation links for medications, measurements, imaging, plans, referrals, exercises, and target entities.
- [x] T057: Add reviewer uncertainty cues for ambiguous shorthand, broad codes, missing terminology, and missing clinical links.
- [x] T058: Add named terminology provider adapter plus mock FHIR Terminology provider shape.
- [x] T059: Expand dictionary and regex coverage for chronic conditions, symptoms, meds, scores, and PT tests.
- [x] T060: Add starter clinical evaluation fixture set and recall scoring helper.
- [x] T061: Add local latest-session save, restore, and clear controls.
- [x] T062: Surface section chips, relation counts, review-priority chips, relation detail, and saved-session state in the UI.
- [x] T063: Add regression tests for section parsing, relation linking, uncertainty, provider adapters, eval fixtures, local persistence, and UI save/restore.

### Batch 13: Synthetic Eval Expansion & Async Terminology Mock

- [x] T064: Expand the clinical evaluation fixture set to five synthetic notes per context.
- [x] T065: Add async mock terminology provider methods shaped like future FHIR `$lookup` and `$expand` calls.
- [x] T066: Add regression tests for fixture distribution, fixture recall, async lookup, and async expansion.

### Batch 14: Eval Lab, Relation Review & Terminology Demo UI

- [x] T067: Add Eval Lab UI for selecting, filtering, loading, and scoring synthetic notes.
- [x] T068: Show expected, found, missed, and extra entities plus per-note and overall recall.
- [x] T069: Show coverage backlog items derived from evaluation misses.
- [x] T070: Add relation review status and accept/reject/reset controls.
- [x] T071: Add selected-entity async terminology lookup and expansion UI.
- [x] T072: Add component regression tests for Eval Lab loading, relation review, and terminology demo behavior.

### Batch 15: Hardening & Operational Finish

- [x] T073: Broaden the ASHA-sourced abbreviation starter registry while preserving ambiguity warnings for overlapping shorthand.
- [x] T074: Score abbreviation resolution from mention-local evidence before document-wide specialty context.
- [x] T075: Surface abbreviation evidence and mention counts in entity detail review.
- [x] T076: Add local FHIR Bundle quality checks for required resource shape, ids, subjects, coding URIs, and Observation values.
- [x] T077: Add deployed server health, provider-manifest, and in-memory session API endpoints.
- [x] T078: Add a dependency-free Railway deployment smoke script and documentation.
- [x] T079: Add regression tests for abbreviation evidence and FHIR quality validation.

### Batch 16: Reviewer-Visible FHIR Quality

- [x] T080: Show local FHIR quality pass/fail state in the document output panel.
- [x] T081: Show FHIR resource counts by resource type plus warning and error counts.
- [x] T082: Add component regression coverage for visible FHIR quality output.

## Review Checkpoints

- Batch 1 complete: project installs and scripts are available.
- Batch 2 complete: extractor returns structured entities from all sample texts.
- Batch 3 complete: user can paste, extract, review highlights, and inspect details.
- Batch 4 complete: tests and build pass.
- Batch 5 complete: mapped entities show code candidates and a prototype FHIR resource preview.
- Batch 6 complete: reviewer coding decisions are visible and reflected in generated FHIR previews.
- Batch 7 complete: vital sign shorthand extracts into coded entities and FHIR Observation previews.
- Batch 8 complete: reviewers can correct, remove, confirm, and manually add entities.
- Batch 9 complete: reviewed notes can be exported as session JSON and previewed as FHIR Bundles.
- Batch 10 complete: allergies and medication sigs extract into structured entities and FHIR previews.
- Batch 11 complete: terminology lookup is swappable, and expanded clinical coverage extracts with coded candidates, structured attributes, source spans, and FHIR previews where applicable.
- Batch 12 complete: section-aware extraction, inferred relations, uncertainty cues, provider adapter shape, eval fixtures, and latest-session persistence are available and covered by automated tests.
- Batch 13 complete: the synthetic eval set covers five notes per context, and the async mock terminology provider supports lookup/expand-shaped integration tests without external calls.
- Batch 14 complete: the eval set is visible and actionable in the prototype, relation links are reviewable, and mock terminology lookup/search can be exercised from the UI.
- Batch 15 complete: abbreviation disambiguation is evidence-aware, the ASHA-backed registry is broader, FHIR previews have local structural quality checks, and Railway exposes smoke-testable operational API endpoints.
- Batch 16 complete: reviewers can see local FHIR Bundle quality status and resource mix before copying or downloading exports.
