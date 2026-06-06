import { buildExtractionSession, type ExtractionSession } from "./documentOutput";
import type { ClinicalEntity, Specialty } from "./types";

export const latestSessionStorageKey = "clinical-entity-extractor.latest-session";

export type SavedExtractionSession = ExtractionSession & {
  savedAt: string;
  name: string;
};

export function saveLatestSession(
  text: string,
  specialty: Specialty,
  entities: ClinicalEntity[],
  storage: Storage = window.localStorage
) {
  const savedSession: SavedExtractionSession = {
    ...buildExtractionSession(text, specialty, entities),
    savedAt: new Date().toISOString(),
    name: buildSessionName(text)
  };
  storage.setItem(latestSessionStorageKey, JSON.stringify(savedSession));
  return savedSession;
}

export function loadLatestSession(storage: Storage = window.localStorage): SavedExtractionSession | null {
  const raw = storage.getItem(latestSessionStorageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SavedExtractionSession;
    if (!isSavedExtractionSession(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLatestSession(storage: Storage = window.localStorage) {
  storage.removeItem(latestSessionStorageKey);
}

function buildSessionName(text: string) {
  const firstLine = text
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Untitled clinical note";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function isSavedExtractionSession(value: SavedExtractionSession) {
  return (
    value?.schemaVersion === "prototype-1" &&
    typeof value.sourceText === "string" &&
    Array.isArray(value.entities) &&
    typeof value.specialty === "string" &&
    typeof value.savedAt === "string"
  );
}
