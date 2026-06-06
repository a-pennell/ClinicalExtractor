# Data Model: Clinical Entity Extraction Prototype

## Specialty

Represents the clinical context selected by the user.

Values:

- `primary-care`
- `mental-health`
- `physical-therapy`
- `mixed`

## ClinicalEntityType

Classifies extracted concepts for grouping and review.

Values:

- `problem`
- `symptom`
- `finding`
- `medication`
- `allergy`
- `procedure`
- `lab`
- `vital`
- `score`
- `body-site`
- `laterality`
- `duration`
- `severity`
- `functional-limitation`
- `plan`
- `referral`
- `imaging`
- `exercise`
- `special-test`
- `risk`
- `other`

## AssertionStatus

Represents the entity assertion inferred from local context.

Values:

- `present`
- `absent`
- `possible`
- `historical`
- `family-history`
- `planned`
- `ordered`

## EntityMention

Represents one source span in the clinical text.

Fields:

- `text`: matched source text
- `start`: starting character offset
- `end`: ending character offset
- `sentence`: optional containing sentence or phrase-like segment
- `section`: optional normalized clinical section name

## ClinicalEntity

Represents one unique normalized clinical concept.

Fields:

- `id`: local UI identifier
- `canonicalName`: normalized concept key
- `displayName`: human-readable label
- `type`: clinical entity type
- `specialties`: relevant clinical specialty contexts
- `mentions`: all source mentions for the unique entity
- `attributes`: optional structured attributes such as value, unit, systolic, diastolic, dose, route, frequency, sig, PRN status, indication, substance, reaction, family member, imaging modality, duration, severity, laterality, assertion, temporality, and normalized term
- `codings`: optional terminology coding candidates
- `relations`: optional inferred links to other extracted entities
- `uncertainty`: optional review-priority cues and reasons
- `confidence`: high, medium, or low
- `explanation`: optional matching rationale
- `review`: optional reviewer state including status and note

## ClinicalSection

Represents a detected clinical note section.

Fields:

- `id`: local section identifier
- `title`: human-readable title
- `normalizedName`: normalized section label such as PMH, Meds, Family Hx, Objective, Assessment, Plan, or unknown
- `start`: starting source offset for section content
- `end`: ending source offset for section content

## EntityRelation

Represents an inferred prototype relationship between two extracted entities.

Fields:

- `type`: treats, measures, ordered-for, documents, supports, or plan-for
- `targetEntityId`: linked target entity id
- `targetCanonicalName`: linked target canonical name
- `targetDisplayName`: linked target display name
- `confidence`: high, medium, or low
- `status`: candidate, accepted, or rejected
- `explanation`: relation rationale

## EntityUncertainty

Represents reviewer-facing uncertainty cues.

Fields:

- `reviewPriority`: routine, needs-review, or high
- `reasons`: list of human-readable reasons such as ambiguous shorthand, low confidence, broad coding, missing terminology candidate, or missing linked clinical target

## EntityReview

Represents human review state for an extracted or manually added entity.

Fields:

- `status`: unreviewed, reviewed, edited, or manual
- `note`: optional reviewer note

## CandidateCoding

Represents a suggested terminology code for a clinical entity. These are prototype candidates and are not final clinical coding decisions.

Fields:

- `system`: terminology system such as ICD-10-CM, SNOMED-CT, LOINC, RxNorm, CPT, or HCPCS
- `code`: code value
- `display`: human-readable display
- `version`: optional system version, such as FY2026 for ICD-10-CM
- `confidence`: high, medium, or low
- `status`: candidate, selected, or rejected
- `rationale`: optional explanation or coding caveat

## TerminologyLookup

Represents the swappable terminology lookup boundary used to decorate extracted entities with candidate codes.

Fields:

- `lookupCandidates`: function that accepts a canonical name, entity type, and optional attributes, then returns zero or more `CandidateCoding` values

Implementation notes:

- The current prototype uses `localTerminologyLookup`, a static in-repo terminology map plus small dynamic modality-based imaging lookup.
- The boundary is intentionally narrow so a future ICD-10-CM, SNOMED CT, LOINC, RxNorm, FHIR terminology service, or clinical NLP service can replace the local lookup without rewriting extraction rules.

## TerminologyProvider

Represents a named terminology-provider adapter.

Fields:

- `id`: provider identifier such as local-static or mock-fhir-terminology
- `label`: user/developer-readable provider label
- `lookup`: function accepting a terminology lookup request and returning candidate codings plus optional warnings

## AsyncTerminologyProvider

Represents a future-service-shaped terminology adapter that can be awaited by UI or service orchestration code.

Fields:

- `id`: provider identifier such as mock-async-fhir-terminology
- `label`: user/developer-readable provider label
- `lookup`: async `$lookup`-style function accepting a canonical concept request and returning candidate codings plus warnings
- `expand`: async `$expand`-style function accepting filter, optional system, optional value set URL, and limit, then returning matching candidate codings plus warnings

Implementation notes:

- The current async provider is a mock that reuses local candidate mappings.
- It does not make external network calls.

## FHIR Preview Resource

Represents a generated per-entity FHIR-like JSON preview for interoperability review.

Mapping intent:

- Problems and risks map to `Condition`
- Labs, vitals, scores, findings, severity, and special tests map to `Observation`
- Medications map to `MedicationStatement`
- Allergies map to `AllergyIntolerance`
- Plans, referrals, and ordered work map to `ServiceRequest`
- Procedures and exercises map to `Procedure`
- Blood pressure maps to an `Observation` with systolic and diastolic components

Coding review behavior:

- If one or more codings are selected, FHIR previews include selected codings only.
- If no codings are selected, FHIR previews include non-rejected candidate codings.
- Rejected codings are omitted from FHIR previews.

## ExtractionSession

Represents the document-level output for one note review.

Fields:

- `schemaVersion`: prototype schema version
- `specialty`: selected specialty context
- `specialtyLabel`: human-readable specialty label
- `sourceText`: original source text
- `sections`: detected clinical sections
- `summary`: entity count, reviewed count, selected coding count, relation count, high-priority review count, and counts by entity type
- `entities`: reviewed clinical entities

## SavedExtractionSession

Represents the latest locally persisted prototype case-review session.

Fields:

- all `ExtractionSession` fields
- `savedAt`: ISO timestamp
- `name`: short note-derived session label

## EvaluationFixture

Represents a lightweight extraction quality fixture.

Fields:

- `id`: fixture identifier
- `specialty`: selected extraction context
- `text`: fixture note text
- `expectedCanonicalNames`: expected canonical entities used for recall checks

Current fixture set:

- Five synthetic primary-care notes
- Five synthetic mental-health notes
- Five synthetic physical-therapy notes
- Five synthetic mixed-context notes

## EvaluationCaseResult

Represents extraction performance against one synthetic fixture.

Fields:

- `id`: fixture identifier
- `specialty`: fixture context
- `expectedCount`: expected canonical entity count
- `matchedCount`: expected entities found by the extractor
- `recall`: matched expected entities divided by expected entities
- `expectedCanonicalNames`: expected entities
- `foundCanonicalNames`: extracted entities
- `missedCanonicalNames`: expected entities not found
- `extraCanonicalNames`: extracted entities outside the expected set

## CoverageBacklogItem

Represents one actionable eval miss.

Fields:

- `fixtureId`: source fixture id
- `specialty`: fixture context
- `canonicalName`: missed expected entity

## FHIR Bundle Preview

Represents document-level FHIR preview output as a collection bundle.

Fields:

- `resourceType`: Bundle
- `type`: collection
- `entry`: one entry per extracted entity using the per-entity FHIR preview resource

## EntityPattern

Represents one dictionary-driven extraction rule.

Fields:

- `canonicalName`
- `displayName`
- `type`
- `terms`
- `specialties`
- `confidence`

## ExtractionOptions

Represents runtime extraction choices.

Fields:

- `specialty`: selected specialty context

## Segment

Represents a sentence-like source segment used for context-aware matching.

Fields:

- `text`
- `start`
- `end`
- `section`
