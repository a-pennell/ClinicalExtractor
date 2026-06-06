import { beforeEach, describe, expect, it } from "vitest";
import { clearLatestSession, latestSessionStorageKey, loadLatestSession, saveLatestSession } from "./sessionPersistence";
import { extractClinicalEntities } from "./extractClinicalEntities";

describe("sessionPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves, loads, and clears the latest extraction session", () => {
    const text = "HTN controlled.";
    const entities = extractClinicalEntities(text, { specialty: "primary-care" });
    const saved = saveLatestSession(text, "primary-care", entities);

    expect(saved.name).toBe(text);
    expect(loadLatestSession()?.entities[0].canonicalName).toBe("hypertension");

    clearLatestSession();
    expect(loadLatestSession()).toBeNull();
  });

  it("ignores malformed saved payloads", () => {
    window.localStorage.setItem(latestSessionStorageKey, "{nope");
    expect(loadLatestSession()).toBeNull();
  });
});
