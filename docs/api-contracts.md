# API Contract Skeleton

This prototype is browser-local today. These contracts define the next backend shape without requiring a database yet.

## Extraction Providers

Provider IDs:

- `local-rules`
- `llm-extractor-placeholder`
- `clinical-nlp-service-placeholder`

All providers return the same document shape:

```ts
type ExtractionProviderResult = {
  providerId: string;
  providerLabel: string;
  context: DetectedClinicalContext;
  entities: ClinicalEntity[];
  warnings: string[];
};
```

External providers should remain disabled unless configured. When disabled, they must return local-rule fallback output with a warning.

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

Runs the configured extraction provider.

Request:

```json
{
  "providerId": "local-rules",
  "contextMode": "auto",
  "specialtyOverride": null
}
```

Response:

```json
{
  "providerId": "local-rules",
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
