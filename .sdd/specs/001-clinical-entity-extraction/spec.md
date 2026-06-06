# Feature Specification: Clinical Entity Extraction Prototype

## User Scenarios & Testing

### User Story 1 - Extract entities from clinical text (Priority: P1)

Clinicians in primary care, mental health, and physical therapy need to paste or type rough clinical text and quickly see unique structured clinical entities. This is the core workflow because the prototype is intended to validate the extraction UX and entity model.

Independent Test: Paste one of the provided specialty examples, select the matching specialty context, run extraction, and verify that grouped clinical entities appear with source mentions.

Acceptance Scenarios:

- Given clinical text is present, when the user clicks "Extract entities", then the system displays unique extracted entities grouped by type.
- Given the same concept appears more than once, when extraction completes, then the system shows one entity with multiple source mentions.
- Given the source text is blank, when extraction runs, then the system does not error and shows an empty state.
- Given the user deletes all source text, then stale extracted entities, highlights, and details are cleared.

### User Story 2 - Review source evidence (Priority: P1)

Clinicians need to see where each entity came from in the original note so they can judge whether extraction results are trustworthy. This is required for a clinical review workflow, even in a lo-fi prototype.

Independent Test: Run extraction on an example note, click a highlighted source span, and verify that the matching entity details are shown.

Acceptance Scenarios:

- Given extraction results exist, when the user views the original text, then matched source spans are highlighted.
- Given the user clicks a highlighted span, then details for the linked entity become visible.
- Given an entity has repeated mentions, then all source mentions are preserved and inspectable.

### User Story 3 - Capture assertion and clinical context (Priority: P2)

Clinicians need obvious handling for absent, ordered, or present findings so negated problems and planned work are not confused with active problems.

Independent Test: Paste a note containing "Denies SI/HI", "Denies CP/SOB", or "Ordered CMP", run extraction, and verify assertion status.

Acceptance Scenarios:

- Given a phrase is negated, when extraction completes, then the entity assertion is marked absent.
- Given a lab or action is ordered, when extraction completes, then the entity assertion is marked ordered.
- Given an entity is present without negation or ordering language, then the entity assertion is marked present.

### User Story 4 - Compare specialty examples (Priority: P3)

Product and clinical stakeholders need starter examples for primary care, mental health, physical therapy, and mixed notes to evaluate coverage across domains.

Independent Test: Click each example input button and verify that the text, specialty context, highlights, and grouped results update.

Acceptance Scenarios:

- Given the user clicks a primary care example, then the prototype loads primary care text and extraction results.
- Given the user clicks a mental health example, then the prototype loads behavioral health text and extraction results.
- Given the user clicks a physical therapy example, then the prototype loads PT text and extraction results.
- Given the user clicks a mixed example, then the prototype loads mixed clinical text and extraction results.

## Requirements

### Functional Requirements

- FR-001: System MUST allow users to type or paste clinical text into a large text area.
- FR-002: System MUST allow users to select one specialty context: Primary Care, Mental Health, Physical Therapy, or Mixed / Auto.
- FR-003: System MUST provide example input buttons for Primary Care, Mental Health, Physical Therapy, and Mixed contexts.
- FR-004: System MUST extract structured clinical entities from raw text without requiring an external API.
- FR-005: System MUST group extracted entities by clinical entity type.
- FR-006: System MUST display confidence for each extracted entity.
- FR-007: System MUST preserve all source mentions for each unique entity.
- FR-008: System MUST highlight source spans in the original clinical text.
- FR-009: System MUST let the user click an entity or source span to review entity details.
- FR-010: System MUST detect common clinical shorthand and abbreviations for universal, primary care, mental health, and physical therapy contexts.
- FR-011: System MUST detect common negation phrases and mark affected entities as absent.
- FR-012: System MUST detect simple values such as scores, pain ratings, vitals, lab values, ROM values, strength grades, frequencies, and durations.
- FR-013: System MUST deduplicate repeated mentions of the same clinical concept.
- FR-014: System MUST behave safely for blank input without throwing an error.
- FR-015: System MUST expose a TypeScript clinical entity model suitable for replacement by a future NLP or LLM extractor.
- FR-016: System MUST clear extracted entities when the source text is emptied.
- FR-017: System MUST include starter mental-health coverage for common diagnostic shorthand and plain-language variants such as MDD, major depression, GAD, PTSD, and AVH.
- FR-018: System MUST support local candidate terminology codings for mapped entities without treating them as final clinical codes.
- FR-019: System MUST show a per-entity FHIR preview for prototype interoperability review.
- FR-020: System MUST allow a reviewer to mark candidate codings as selected, rejected, or candidate.
- FR-021: System MUST prefer selected codings and omit rejected codings in the generated FHIR preview.
- FR-022: System MUST extract common vital sign shorthand including BP, HR, RR, SpO2, temperature, and weight.
- FR-023: System MUST represent blood pressure in FHIR preview with systolic and diastolic components.
- FR-024: System MUST allow reviewers to edit extracted entity display name, type, assertion, confidence, and note.
- FR-025: System MUST allow reviewers to mark entities reviewed.
- FR-026: System MUST allow reviewers to delete false positive entities.
- FR-027: System MUST allow reviewers to add a missed entity from selected source text.
- FR-028: System MUST generate a document-level extraction session JSON payload.
- FR-029: System MUST generate a document-level FHIR Bundle preview.
- FR-030: System MUST show document-level summary counts by entity type, reviewed count, selected code count, and FHIR entry count.
- FR-031: System MUST support copying or downloading the extraction session JSON.
- FR-032: System MUST extract allergy entities including substance, assertion, and optional reaction.
- FR-033: System MUST extract common no-known-allergy shorthand such as NKDA.
- FR-034: System MUST extract richer medication sig details including dose, route, frequency, PRN status, and indication when present.
- FR-035: System MUST keep medication entities distinct by medication name instead of merging all medication doses.
- FR-036: System MUST map allergy entities to FHIR AllergyIntolerance previews.
- FR-037: System MUST expose terminology lookup behind a swappable local abstraction.
- FR-038: System MUST extract common lab-result shorthand including CBC, Hgb, WBC, Plt, TSH, Cr, eGFR, LDL, HDL, TG, and total cholesterol.
- FR-039: System MUST extract social and family history concepts including tobacco use, alcohol use, substance use, and family-history statements.
- FR-040: System MUST extract imaging, referral, and procedure concepts from common clinical phrasing.
- FR-041: System MUST extract additional physical therapy and mental-health findings including gait abnormality, impaired balance, fall risk, safety plan, panic attacks, and mania/hypomania.
- FR-042: System MUST preserve common clinical acronyms in extracted display names.
- FR-043: System MUST detect common clinical note sections such as PMH, Meds, Family Hx, Assessment, and Plan.
- FR-044: System MUST annotate extracted mentions with detected section context.
- FR-045: System MUST infer starter relationships between related entities such as medications, measurements, plans, imaging, and target problems.
- FR-046: System MUST expose a terminology provider adapter shape that can wrap the local map or a future terminology service.
- FR-047: System MUST expose uncertainty and review-priority cues for ambiguous or underspecified entities.
- FR-048: System MUST provide a starter clinical evaluation fixture set with expected canonical entities.
- FR-049: System MUST allow the user to save, restore, and clear the latest prototype extraction session locally.
- FR-050: System MUST include synthetic evaluation notes across Primary Care, Mental Health, Physical Therapy, and Mixed contexts.
- FR-051: System MUST include an async mock terminology provider shaped like future `$lookup` and `$expand` service calls without making external requests.
- FR-052: System MUST provide an Eval Lab UI for loading synthetic notes and comparing expected, found, missed, and extra entities.
- FR-053: System MUST show an actionable coverage backlog derived from eval misses.
- FR-054: System MUST allow reviewers to accept, reject, or reset inferred entity relations.
- FR-055: System MUST provide a terminology demo UI for async mock lookup and expansion.

### Non-Functional Requirements

- NFR-001: Extraction logic SHOULD be pure and testable.
- NFR-002: Prototype SHOULD remain lo-fi and easy to extend.
- NFR-003: Prototype SHOULD avoid heavy dependencies unless clearly justified.
- NFR-004: UI SHOULD reuse existing design patterns when present; otherwise it SHOULD provide simple low-fidelity components.

## Success Criteria

- SC-001: A user can complete the full paste, extract, review, and inspect-detail workflow in one screen.
- SC-002: Each provided sample note returns at least one highlighted entity and at least one grouped result.
- SC-003: Negated examples such as "Denies SI/HI" and "Denies CP/SOB" are marked absent.
- SC-004: Equivalent concepts such as "LBP" and "low back pain" can be represented as one unique entity with multiple mentions.
- SC-005: Automated tests cover at least abbreviation normalization, negation, deduplication, and value extraction.
- SC-006: Mapped entities can display terminology candidates and a generated FHIR resource preview.
- SC-007: A reviewer can adjudicate candidate codes and see that decision reflected in the FHIR preview.
- SC-008: Common vital sign shorthand can be extracted with values, units, LOINC candidates, and FHIR Observation previews.
- SC-009: A reviewer can correct, delete, mark reviewed, and manually add entities without rerunning extraction.
- SC-010: A reviewed note can be represented as session JSON and a FHIR Bundle preview.
- SC-011: Allergy and medication sig examples are extracted into structured entities and represented in FHIR previews.
- SC-012: Expanded lab, social-history, family-history, imaging, referral, procedure, physical-therapy, and mental-health examples extract as grouped entities with source spans.
- SC-013: Sectioned notes preserve section context on extracted mentions and in exported session JSON.
- SC-014: Related extracted entities can display inferred links and review-priority cues.
- SC-015: The starter evaluation fixture set runs in automated tests with expected entity recall.
- SC-016: A user can save and restore the latest reviewed extraction session in the browser.
- SC-017: The synthetic evaluation set includes at least five mock notes per supported context.
- SC-018: Async mock terminology lookup and expansion can return filtered candidate codes without network access.
- SC-019: Users can load an eval fixture into the extraction workflow and inspect per-note recall.
- SC-020: Users can adjudicate inferred relation links in the entity detail panel.
- SC-021: Users can run mock terminology lookup and search from the selected entity detail panel.
