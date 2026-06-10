# ClinicalExtractor

Lo-fi Vite + React prototype for extracting structured clinical entities from typed or pasted note text. The extraction pipeline is local and rule-based: dictionaries, regex patterns, negation cues, abbreviation expansion, deduping, relation hints, starter terminology mappings, and FHIR-preview output.

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run build
```

Run the production build locally:

```bash
npm run build
npm start
```

`npm start` serves `dist/` through `server.mjs`, a small Node static/API server that binds to `0.0.0.0`, respects Railway's `PORT` environment variable, and spawns the Python `clinical_nlp` engine over stdio.

## Railway Deployment

1. Create a Railway project from the GitHub repo.
2. Use branch `main`.
3. Let Railway build from the root `Dockerfile`; it provisions Node plus Python 3.11, installs `pydantic==2.13.4`, installs `clinical_nlp` importably, and runs `npm run build`.
4. Start command remains `npm run start` via the Dockerfile `CMD`.
5. Generate a public domain from the Railway service networking settings.

No database or external NLP APIs are required for the current prototype. The Docker image sets `ENGINE_PYTHON=/opt/venv/bin/python` so `server.mjs` can spawn `python -m clinical_nlp.service`.

Post-deploy checklist: [docs/deployment-smoke-test.md](docs/deployment-smoke-test.md).

Backend persistence design: [docs/backend-persistence-design.md](docs/backend-persistence-design.md).

API contract skeleton: [docs/api-contracts.md](docs/api-contracts.md). The production server also exposes lightweight `/api/health`, `/api/engine/health`, `/api/providers`, and in-memory session endpoints for deployment smoke tests.

## Prototype Capabilities

- Specialty contexts: Primary Care, Mental Health, Physical Therapy, and Mixed / Auto.
- Highlighted source spans linked to unique structured entities.
- Entity detail review with assertion, confidence, coding, relation, and reviewer-state controls.
- Starter terminology candidates for ICD-10-CM, SNOMED CT, LOINC, RxNorm, CPT, and HCPCS.
- Document-level JSON, FHIR Bundle preview, reviewer report, clipboard summary exports, and visible FHIR quality summary.
- ASHA-sourced abbreviation registry starter with context-aware ambiguity review for overlapping shorthand.
- Local FHIR Bundle quality checks for prototype resource shape, required ids, coding URIs, subjects, and Observation values.
- Browser-side session persistence: latest-session localStorage compatibility plus an IndexedDB session library for multiple saved review cases.
- Synthetic eval lab with mock notes across primary care, mental health, physical therapy, and mixed contexts.

## Important Limitations

- This is not production clinical NLP.
- Terminology mappings are starter candidates and must be validated against authoritative terminology services before clinical, billing, quality, or interoperability use.
- FHIR output is a preview of resource shape with local structural checks, not a validated implementation guide profile.

Deployment smoke check after `npm run build` and `npm start`:

```bash
npm run smoke:deployment -- http://127.0.0.1:4173
```

Treat the same smoke command against the Railway public URL as a required post-deploy gate; it fails if the Python `clinical_nlp` engine is unavailable or extraction falls back to the frozen browser path.
- Session persistence is local to the browser and is not shared across users or devices.
