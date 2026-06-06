# Tasks: Clinical Entity Extraction Prototype

## Phase 1: Setup

- [x] T001 Create Vite React TypeScript scaffold at repository root.
- [x] T002 [P] Add package scripts for dev, build, preview, and test.
- [x] T003 [P] Add TypeScript, Vite, and Vitest configuration.
- [x] T004 Add `.gitignore` for generated build and dependency folders.

## Phase 2: Foundational

- [x] T005 [P] Define clinical entity TypeScript model in `src/lib/clinical-extraction/types.ts`.
- [x] T006 [P] Add specialty labels and matching helper in `src/lib/clinical-extraction/specialtyProfiles.ts`.
- [x] T007 [P] Add sample clinical inputs in `src/lib/clinical-extraction/sampleInputs.ts`.
- [x] T008 Add universal and specialty abbreviation dictionaries in `src/lib/clinical-extraction/abbreviationDictionaries.ts`.

## Phase 3: User Story 1 (P1) - Extract entities from clinical text

- [x] T009 [US1] Implement sentence-like segmentation in `src/lib/clinical-extraction/extractClinicalEntities.ts`.
- [x] T010 [US1] Implement dictionary-based entity matching in `src/lib/clinical-extraction/extractClinicalEntities.ts`.
- [x] T011 [US1] Implement regex-based value detection in `src/lib/clinical-extraction/regexPatterns.ts`.
- [x] T012 [US1] Implement entity deduplication in `src/lib/clinical-extraction/dedupeEntities.ts`.
- [x] T013 [US1] Implement main prototype container in `src/components/clinical-entity-extractor/ClinicalEntityExtractorPrototype.tsx`.
- [x] T014 [US1] Implement text area and specialty controls.
- [x] T015 [US1] Implement grouped entity display.

## Phase 4: User Story 2 (P1) - Review source evidence

- [x] T016 [US2] Preserve source mention offsets for every extraction.
- [x] T017 [US2] Implement highlighted source text in `HighlightedClinicalText.tsx`.
- [x] T018 [US2] Implement clickable entity cards in `EntityCard.tsx`.
- [x] T019 [US2] Implement entity detail panel in `EntityDetailPanel.tsx`.

## Phase 5: User Story 3 (P2) - Capture assertion and clinical context

- [x] T020 [US3] Implement negation detection in `negationRules.ts`.
- [x] T021 [US3] Mark negated entities as absent.
- [x] T022 [US3] Detect ordered context for labs and plan-like entities.
- [x] T023 [US3] Surface assertion status in cards and detail panel.

## Phase 6: User Story 4 (P3) - Compare specialty examples

- [x] T024 [US4] Add example buttons for all specialty contexts.
- [x] T025 [US4] Update text, context, extraction results, highlights, and detail selection when examples are loaded.

## Phase 7: Polish & Cross-Cutting

- [x] T026 Add low-fidelity responsive clinical workbench styling in `src/styles.css`.
- [x] T027 Add extraction tests for abbreviation normalization, negation, dedupe, and value extraction.
- [x] T028 Run `npm test`.
- [x] T029 Run `npm run build`.
- [x] T030 Start local dev server for interactive review.
- [x] T031 Clear extracted entities, highlights, and selected detail when source text is emptied.
- [x] T032 Add UI regression test for clearing extracted entities after deleting source text.
- [x] T033 Expand starter mental-health entity coverage for MDD, major depression, GAD, PTSD, and AVH.
- [x] T034 Add regression coverage for mental-health diagnosis synonyms and shorthand boundary matching.
- [x] T035 Add candidate terminology coding model and local mapping module.
- [x] T036 Decorate extracted entities with starter ICD-10-CM, SNOMED CT, LOINC, and RxNorm candidates.
- [x] T037 Add per-entity FHIR preview mapper.
- [x] T038 Show candidate codes and FHIR preview in the entity detail panel.
- [x] T039 Add regression tests for coding candidates and FHIR preview resources.
- [x] T040 Add candidate code review controls for selected, rejected, and candidate statuses.
- [x] T041 Reflect selected and rejected code review decisions in FHIR preview generation.
- [x] T042 Add regression tests for code adjudication and FHIR coding preference behavior.
- [x] T043 Add common vital sign extraction for BP, HR, RR, SpO2, temperature, and weight.
- [x] T044 Add LOINC candidates for extracted vital signs.
- [x] T045 Represent blood pressure as systolic and diastolic FHIR Observation components.
- [x] T046 Add regression tests for vital sign extraction and FHIR blood pressure components.
- [x] T047 Add entity review state to the clinical entity model.
- [x] T048 Add edit controls for display name, type, assertion, confidence, and reviewer note.
- [x] T049 Add mark-reviewed and delete-entity actions.
- [x] T050 Add manual entity creation from selected source text.
- [x] T051 Add review status chips and reviewed-count summary.
- [x] T052 Add regression tests for edit, reviewed, delete, and manual-add workflows.
- [x] T053 Add document-level extraction session JSON builder.
- [x] T054 Add document-level FHIR Bundle preview builder.
- [x] T055 Add document output panel with summary counts, copy JSON, download JSON, session JSON, and FHIR Bundle preview.
- [x] T056 Add regression tests for document session and FHIR Bundle output.
- [x] T057 Add medication sig extraction for dose, route, frequency, PRN, and indication.
- [x] T058 Normalize medication entities by medication name to avoid cross-medication merging.
- [x] T059 Add starter medication dictionary and RxNorm candidates for metformin, ibuprofen, acetaminophen, and albuterol.
- [x] T060 Add allergy extraction for substance, reaction, and no-known-allergy shorthand.
- [x] T061 Add FHIR AllergyIntolerance preview output.
- [x] T062 Add regression tests for medication sigs, allergy extraction, FHIR medication dosage, and AllergyIntolerance.
- [x] T063 Add swappable terminology lookup abstraction around local candidate coding mappings.
- [x] T064 Add expanded lab-result coverage for CBC, Hgb, WBC, Plt, TSH, Cr, eGFR, LDL, HDL, TG, and total cholesterol.
- [x] T065 Add social and family history extraction for tobacco, alcohol, substance use, and family-history statements.
- [x] T066 Add imaging, referral, and procedure extraction with structured modality, body-site, and planned/ordered attributes.
- [x] T067 Add PT and mental-health coverage for gait abnormality, impaired balance, fall risk, safety plan, panic attacks, and mania/hypomania.
- [x] T068 Add starter candidate codings for expanded labs, social history, family history, PT findings, colonoscopy, and modality-based imaging.
- [x] T069 Map imaging entities to FHIR ServiceRequest previews.
- [x] T070 Preserve clinical acronyms such as MRI in extracted display names.
- [x] T071 Add regression tests for terminology abstraction and expanded clinical coverage.
- [x] T072 Add clinical section parser for PMH, Meds, Family Hx, Assessment, Plan, and related headings.
- [x] T073 Annotate segments and entity mentions with section context.
- [x] T074 Use section context for starter assertion and temporality hints.
- [x] T075 Add inferred relation links between medications, measurements, plans, imaging, and target entities.
- [x] T076 Add uncertainty and review-priority annotations for ambiguous or underspecified entities.
- [x] T077 Add named terminology provider adapter and mock FHIR Terminology provider shape.
- [x] T078 Expand dictionary coverage for chronic conditions, common symptoms, medications, mental-health scores, and PT tests.
- [x] T079 Add starter evaluation fixtures and recall scoring helper.
- [x] T080 Add local latest-session save, restore, and clear behavior.
- [x] T081 Surface sections, relation counts, review cues, and saved-session controls in the UI.
- [x] T082 Add regression tests for sections, relations, uncertainty, provider adapter, eval fixtures, persistence, and UI save/restore.
- [x] T083 Expand synthetic evaluation fixtures to five notes per supported context.
- [x] T084 Add async mock terminology provider with `$lookup` and `$expand` shaped methods.
- [x] T085 Add regression tests for async terminology lookup, terminology expansion, eval set distribution, and fixture recall.
- [x] T086 Add Eval Lab UI for fixture filtering, loading, and expected/found/missed/extra comparison.
- [x] T087 Add coverage backlog view from evaluation misses.
- [x] T088 Add relation adjudication statuses and accept/reject/reset controls.
- [x] T089 Add selected-entity terminology demo UI for async mock lookup and expansion.
- [x] T090 Add regression tests for Eval Lab loading, relation adjudication, and terminology demo UI.
