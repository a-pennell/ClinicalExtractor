# Backend Persistence Design

This is a backend-ready shape for moving the prototype from browser-local sessions into shared persistence.

## Goals

- Preserve source text, extracted entities, source mentions, codings, relations, reviewer decisions, and exports.
- Keep the current local extraction model portable.
- Make review changes auditable.
- Leave room for future extraction providers such as local rules, LLM, cTAKES, MedSpaCy-like services, or external terminology services.

## Tables

### extraction_sessions

- `id`: primary key
- `created_at`
- `updated_at`
- `created_by`
- `specialty`
- `schema_version`
- `source_text`
- `source_hash`
- `extractor_provider`
- `extractor_version`
- `terminology_provider`
- `terminology_version`
- `status`: draft, reviewed, exported, archived

### clinical_entities

- `id`: primary key
- `session_id`: foreign key to `extraction_sessions`
- `canonical_name`
- `display_name`
- `type`
- `confidence`
- `assertion`
- `temporality`
- `attributes_json`
- `explanation`
- `review_status`
- `review_note`

### entity_mentions

- `id`: primary key
- `entity_id`: foreign key to `clinical_entities`
- `text`
- `start_offset`
- `end_offset`
- `sentence`
- `section`

### entity_codings

- `id`: primary key
- `entity_id`: foreign key to `clinical_entities`
- `system`
- `code`
- `display`
- `version`
- `confidence`
- `status`: candidate, selected, rejected
- `rationale`
- `provider`

### entity_relations

- `id`: primary key
- `source_entity_id`
- `target_entity_id`
- `type`
- `confidence`
- `status`: candidate, accepted, rejected
- `explanation`

### review_events

- `id`: primary key
- `session_id`
- `entity_id`
- `event_type`: created, edited, reviewed, deleted, code-selected, code-rejected, relation-accepted, relation-rejected
- `actor_id`
- `created_at`
- `before_json`
- `after_json`
- `note`

### exports

- `id`: primary key
- `session_id`
- `export_type`: session-json, fhir-bundle, reviewer-report
- `created_at`
- `created_by`
- `content_hash`
- `payload_json` or object-storage pointer

## API Shape

- `POST /sessions`: create a session from source text and specialty.
- `POST /sessions/:id/extract`: run an extraction provider and persist entities.
- `GET /sessions/:id`: return source text, entities, mentions, codings, relations, and review state.
- `PATCH /entities/:id`: update display name, type, assertion, confidence, or review note.
- `POST /entities/:id/review`: mark reviewed or edited.
- `PATCH /codings/:id`: select or reject coding candidates.
- `PATCH /relations/:id`: accept or reject inferred relations.
- `POST /sessions/import`: validate and import exported session JSON.
- `GET /sessions/:id/export/:type`: generate JSON, FHIR preview, or reviewer report.

## FHIR Storage Option

The database can remain the review source of truth while exports generate FHIR resources on demand:

- problems, symptoms, risks -> `Condition` or `Observation` depending on type
- vitals, labs, scores -> `Observation`
- medications -> `MedicationStatement` or `MedicationRequest`
- procedures, imaging, referrals, plans -> `ServiceRequest`, `Procedure`, or `CarePlan` preview resources

Production FHIR should add profile validation, patient/encounter context, identifiers, coding-system versions, and provenance.

## Migration Path

1. Keep browser-local extraction as the first provider.
2. Add `POST /sessions/import` using the same runtime validation module shape.
3. Persist session JSON losslessly.
4. Normalize into tables after import.
5. Add review-event logging.
6. Add provider metadata for rule-based extraction, terminology calls, and future LLM/NLP providers.
