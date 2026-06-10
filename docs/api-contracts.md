# API Contract Skeleton

This prototype uses the Python `clinical_nlp` engine behind the Node server for extraction. These contracts define the backend shape and the deployed server exposes a lightweight operational subset without requiring a database yet.

## Implemented Server Routes

`GET /api/health`

Returns deployment health, service name, timestamp, current extraction mode, and cached engine status.

`GET /api/engine/health`

Returns PHI-safe readiness metadata for the Python `clinical_nlp` engine: status, schema version, Python version, package, mode, and latency fields. Returns 503 when the engine cannot be pinged.

`GET /api/providers`

Returns provider manifests for extraction and terminology. `clinical-nlp-engine` should be `available` in production; `local-rules` is a deprecated browser fallback.

`POST /api/sessions`

Creates an in-memory prototype session with `id`, `specialty`, and `sourceText`.

`POST /api/sessions/:id/extract`

Runs the Python `clinical_nlp` engine and returns an extracted session with the raw `engine-1` envelope plus client-renderable entities. Returns 503 if the engine is unavailable.

`GET /api/sessions/:id/export/:type`

Returns in-memory prototype session metadata. Persistent export generation is still a backend follow-up.

## Extraction Providers

Provider IDs:

- `clinical-nlp-engine`
- `local-rules`

Successful extraction responses return the same document shape:

```ts
type ExtractionProviderResult = {
  providerId: string;
  providerLabel: string;
  context: DetectedClinicalContext;
  entities: ClinicalEntity[];
  warnings: string[];
};
```

`local-rules` remains available only as a documented browser fallback when the server engine is unavailable. Deployment smoke tests must fail if production reports `clinical-nlp-engine` as unavailable.

## Endpoints

### POST /api/sessions

Creates a note/session shell.

Request:

```json
{
  "sourceText": "Pt reports LBP x 3 wks...",
  "contextMode": "auto",
  "specialtyOverride": null
}
```

Response:

```json
{
  "sessionId": "uuid",
  "schemaVersion": "prototype-1",
  "status": "draft"
}
```

### POST /api/sessions/:id/extract

Runs the server-side Python extraction engine.

Request:

```json
{
  "providerId": "clinical-nlp-engine",
  "contextMode": "auto",
  "specialtyOverride": null
}
```

Response:

```json
{
  "providerId": "clinical-nlp-engine",
  "schemaVersion": "engine-1",
  "context": {},
  "entities": [],
  "warnings": []
}
```

### PATCH /api/entities/:id

Saves reviewer edits.

Request:

```json
{
  "displayName": "Hypertension",
  "type": "problem",
  "assertion": "present",
  "confidence": "medium",
  "reviewNote": "Confirmed in assessment."
}
```

### PATCH /api/codings/:id

Selects, rejects, or resets a candidate code.

Request:

```json
{
  "status": "selected"
}
```

### PATCH /api/relations/:id

Accepts, rejects, or resets an inferred relation.

Request:

```json
{
  "status": "accepted"
}
```

### POST /api/sessions/import

Validates and imports exported session JSON.

Request:

```json
{
  "payload": {}
}
```

Response:

```json
{
  "sessionId": "uuid",
  "warnings": []
}
```

### GET /api/sessions/:id/export/:type

Supported export types:

- `session-json`
- `fhir-bundle-preview`
- `reviewer-report`

## Validation Requirements

- Validate imported sessions before saving.
- Rebuild derived summaries and terminology manifests after import.
- Preserve the original source text and entity mentions.
- Treat terminology candidates as review items, not final codes.
- Store provider ID and provider version with every extraction run.

## Backend Readiness

These contracts map to the persistence design in [backend-persistence-design.md](backend-persistence-design.md). The browser-local prototype can be kept as the reference implementation for request/response shape until persistence is added.
