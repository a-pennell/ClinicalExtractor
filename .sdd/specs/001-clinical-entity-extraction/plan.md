# Implementation Plan: Clinical Entity Extraction Prototype

## Summary

Build a lo-fi local prototype that lets clinicians paste clinical text, choose a specialty context, run a rule-based extractor, and review unique structured clinical entities with highlighted source spans. The implementation uses pure TypeScript extraction modules and a React UI, keeping the extraction logic replaceable by a future LLM, cTAKES, MedSpaCy-like service, or clinical terminology service.

## Technical Context

- Language/Version: TypeScript 5
- UI Framework: React 19
- App Framework: Vite
- Primary Dependencies: React, React DOM, lucide-react
- Testing: Vitest with jsdom
- Storage: None
- External APIs: None
- Package Manager: npm

## Project Structure

```text
src/
├── App.tsx
├── main.tsx
├── styles.css
├── components/
│   └── clinical-entity-extractor/
│       ├── ClinicalEntityExtractorPrototype.tsx
│       ├── ClinicalTextInput.tsx
│       ├── EntityCard.tsx
│       ├── EntityDetailPanel.tsx
│       ├── ExtractedEntityPanel.tsx
│       ├── HighlightedClinicalText.tsx
│       └── SpecialtySelector.tsx
└── lib/
    └── clinical-extraction/
        ├── abbreviationDictionaries.ts
        ├── dedupeEntities.ts
        ├── extractClinicalEntities.ts
        ├── extractClinicalEntities.test.ts
        ├── negationRules.ts
        ├── regexPatterns.ts
        ├── sampleInputs.ts
        ├── specialtyProfiles.ts
        └── types.ts
```

## Architecture

- UI components remain display-focused and call a single `extractClinicalEntities` function.
- Clinical entity types and extraction options are defined in one shared TypeScript model file.
- Dictionary matching and regex matching are separate so each can be extended independently.
- Negation and ordered-status detection are isolated in small helpers.
- Deduplication merges repeated mentions by canonical name and type while preserving source mentions.
- Highlight rendering derives source spans from entity mentions and avoids overlapping highlights.

## Validation

- Run `npm test` for extraction behavior.
- Run `npm run build` for TypeScript and production build validation.
- Run `npm run dev` for local interactive review.

## Dependency Decisions

- `lucide-react` is used for lightweight, familiar UI icons.
- No NLP, fuzzy matching, schema validation, or external API package is added in this prototype.
- Vitest is used because the extraction pipeline is pure TypeScript and benefits from fast unit tests.
