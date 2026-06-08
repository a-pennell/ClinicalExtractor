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

`npm start` serves `dist/` through `server.mjs`, a small dependency-free Node static server that binds to `0.0.0.0` and respects Railway's `PORT` environment variable.

## Railway Deployment

1. Create a Railway project from the GitHub repo.
2. Use branch `main`.
3. Build command: `npm run build`.
4. Start command: `npm run start`.
5. Generate a public domain from the Railway service networking settings.

No environment variables, database, or external NLP APIs are required for the current prototype.

Post-deploy checklist: [docs/deployment-smoke-test.md](docs/deployment-smoke-test.md).

Backend persistence design: [docs/backend-persistence-design.md](docs/backend-persistence-design.md).

## Prototype Capabilities

- Specialty contexts: Primary Care, Mental Health, Physical Therapy, and Mixed / Auto.
- Highlighted source spans linked to unique structured entities.
- Entity detail review with assertion, confidence, coding, relation, and reviewer-state controls.
- Starter terminology candidates for ICD-10-CM, SNOMED CT, LOINC, RxNorm, CPT, and HCPCS.
- Document-level JSON, FHIR Bundle preview, reviewer report, and clipboard summary exports.
- Browser-side session persistence: latest-session localStorage compatibility plus an IndexedDB session library for multiple saved review cases.
- Synthetic eval lab with mock notes across primary care, mental health, physical therapy, and mixed contexts.

## Important Limitations

- This is not production clinical NLP.
- Terminology mappings are starter candidates and must be validated against authoritative terminology services before clinical, billing, quality, or interoperability use.
- FHIR output is a preview of resource shape, not a validated implementation guide profile.
- Session persistence is local to the browser and is not shared across users or devices.
