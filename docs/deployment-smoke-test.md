# Deployment Smoke Test

Use this checklist after each Railway deployment.

## Automated Check

Run this against the deployed URL:

```bash
npm run smoke:deployment -- https://your-railway-domain.up.railway.app
```

It verifies the app shell, `/api/health`, `/api/providers`, and prototype session creation before the manual workflow below.

## Public App

- Open the Railway public URL.
- Confirm the workbench renders without a blank screen or blocked-host message.
- Confirm the page title, source note panel, source spans panel, entity detail panel, and Eval Lab are visible.

## Extraction Flow

- Load each sample context: Primary Care, Mental Health, Physical Therapy, and Mixed / Auto.
- Click **Extract entities** for each sample.
- Confirm highlighted source spans appear.
- Confirm grouped entity cards update.
- Click at least one highlight and one entity card.
- Confirm the entity detail panel updates.

## Review Flow

- Edit an entity display name.
- Mark an entity reviewed.
- Select and reject candidate codes.
- Accept and reject an inferred relation where one exists.
- Delete a false-positive entity.
- Add a manual entity from selected source text.

## Persistence Flow

- Click **Save session**.
- Delete the source text and confirm entities clear.
- Click **Restore latest**.
- Confirm text, entities, selected codes, relations, and review status restore.
- Download session JSON.
- Import the downloaded JSON.
- Confirm the imported session rehydrates.

## Output Flow

- Copy JSON.
- Download JSON.
- Copy FHIR.
- Download FHIR.
- Copy summary.
- Download reviewer report.
- Confirm the terminology manifest shows provider and system version metadata.

## Eval Lab

- Confirm the Coverage dashboard is visible.
- Confirm recall by context, entity mix, assertion mix, terminology coverage, and review hotspots render.
- Load at least one eval fixture from each context.
- Confirm the selected fixture extracts expected entities.

## Known Non-Blockers

- Terminology mappings are prototype candidates.
- FHIR output has local structural quality checks, but it is still not IG-validated production FHIR.
- Browser session library is local to the browser and device.
