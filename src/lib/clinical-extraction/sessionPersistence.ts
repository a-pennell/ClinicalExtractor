import { buildExtractionSession, type ExtractionSession } from "./documentOutput";
import { validateExtractionSessionPayload } from "./schemaValidation";
import type { ClinicalEntity, Specialty } from "./types";

export const latestSessionStorageKey = "clinical-entity-extractor.latest-session";
export const sessionDatabaseName = "clinical-entity-extractor";
export const sessionStoreName = "extraction-sessions";

export type SavedExtractionSession = ExtractionSession & {
  id: string;
  savedAt: string;
  name: string;
};

export function saveLatestSession(
  text: string,
  specialty: Specialty,
  entities: ClinicalEntity[],
  storage: Storage = window.localStorage
) {
  const savedSession = buildSavedSession(text, specialty, entities);
  storage.setItem(latestSessionStorageKey, JSON.stringify(savedSession));
  return savedSession;
}

export function loadLatestSession(storage: Storage = window.localStorage): SavedExtractionSession | null {
  const raw = storage.getItem(latestSessionStorageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!isSavedExtractionSession(parsed)) return null;
    return hydrateSavedSession(parsed);
  } catch {
    return null;
  }
}

export function clearLatestSession(storage: Storage = window.localStorage) {
  storage.removeItem(latestSessionStorageKey);
}

export function importSavedSessionJson(
  jsonText: string,
  storage: Storage = window.localStorage
) {
  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return { ok: false as const, errors: ["Import file is not valid JSON."], warnings: [] as string[] };
  }

  const validation = validateExtractionSessionPayload(payload);
  if (!validation.ok) return validation;

  const importedSession: SavedExtractionSession = {
    ...validation.value,
    id: buildSessionId(),
    savedAt: new Date().toISOString(),
    name: buildSessionName(validation.value.sourceText)
  };
  storage.setItem(latestSessionStorageKey, JSON.stringify(importedSession));

  return {
    ok: true as const,
    value: importedSession,
    warnings: validation.warnings
  };
}

export async function saveSessionToLibrary(
  text: string,
  specialty: Specialty,
  entities: ClinicalEntity[],
  databaseFactory: IDBFactory | undefined = globalThis.indexedDB
) {
  const savedSession = buildSavedSession(text, specialty, entities);
  const database = await openSessionDatabase(databaseFactory);
  if (!database) return savedSession;

  await runSessionTransaction(database, "readwrite", (store) => store.put(savedSession));
  database.close();
  return savedSession;
}

export async function listSavedSessions(databaseFactory: IDBFactory | undefined = globalThis.indexedDB) {
  const database = await openSessionDatabase(databaseFactory);
  if (!database) return [];

  const sessions = await runSessionTransaction<SavedExtractionSession[]>(database, "readonly", (store) =>
    store.getAll()
  );
  database.close();
  return sessions.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function loadSavedSession(id: string, databaseFactory: IDBFactory | undefined = globalThis.indexedDB) {
  const database = await openSessionDatabase(databaseFactory);
  if (!database) return null;

  const session = await runSessionTransaction<SavedExtractionSession | undefined>(database, "readonly", (store) =>
    store.get(id)
  );
  database.close();
  return session ?? null;
}

export async function deleteSavedSession(id: string, databaseFactory: IDBFactory | undefined = globalThis.indexedDB) {
  const database = await openSessionDatabase(databaseFactory);
  if (!database) return;

  await runSessionTransaction(database, "readwrite", (store) => store.delete(id));
  database.close();
}

function buildSavedSession(text: string, specialty: Specialty, entities: ClinicalEntity[]): SavedExtractionSession {
  return {
    ...buildExtractionSession(text, specialty, entities),
    id: buildSessionId(),
    savedAt: new Date().toISOString(),
    name: buildSessionName(text)
  };
}

function buildSessionName(text: string) {
  const firstLine = text
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Untitled clinical note";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function hydrateSavedSession(value: SavedExtractionSession): SavedExtractionSession {
  return {
    ...value,
    id: value.id || buildSessionId()
  };
}

function isSavedExtractionSession(value: unknown): value is SavedExtractionSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedExtractionSession>;
  return (
    candidate.schemaVersion === "prototype-1" &&
    typeof candidate.sourceText === "string" &&
    Array.isArray(candidate.entities) &&
    typeof candidate.specialty === "string" &&
    typeof candidate.savedAt === "string"
  );
}

function buildSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openSessionDatabase(databaseFactory?: IDBFactory) {
  if (!databaseFactory) return Promise.resolve(null);

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = databaseFactory.open(sessionDatabaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(sessionStoreName)) {
        database.createObjectStore(sessionStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runSessionTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(sessionStoreName, mode);
    const store = transaction.objectStore(sessionStoreName);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
