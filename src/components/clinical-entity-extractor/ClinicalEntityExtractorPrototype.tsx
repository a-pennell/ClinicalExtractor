import { useEffect, useMemo, useState } from "react";
import { Activity, ClipboardList, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { detectClinicalContext } from "../../lib/clinical-extraction/clinicalContext";
import { extractClinicalEntityDocument } from "../../lib/clinical-extraction/extractClinicalEntities";
import type { EvaluationFixture } from "../../lib/clinical-extraction/evaluationFixtures";
import { sampleInputs } from "../../lib/clinical-extraction/sampleInputs";
import { detectClinicalSections, getSectionForOffset, getSectionLabel } from "../../lib/clinical-extraction/sectionParser";
import {
  clearLatestSession,
  deleteSavedSession,
  importSavedSessionJson,
  listSavedSessions,
  loadLatestSession,
  loadSavedSession,
  saveLatestSession,
  saveSessionToLibrary,
  type SavedExtractionSession
} from "../../lib/clinical-extraction/sessionPersistence";
import { specialtyLabels } from "../../lib/clinical-extraction/specialtyProfiles";
import type {
  AssertionStatus,
  ClinicalEntity,
  ClinicalEntityType,
  CodingStatus,
  Confidence,
  EntityRelationType,
  RelationStatus,
  Specialty,
  TerminologySystem
} from "../../lib/clinical-extraction/types";
import { ClinicalTextInput } from "./ClinicalTextInput";
import { DocumentOutputPanel } from "./DocumentOutputPanel";
import { EntityDetailPanel } from "./EntityDetailPanel";
import { EvalLabPanel } from "./EvalLabPanel";
import { ExtractedEntityPanel } from "./ExtractedEntityPanel";
import { HighlightedClinicalText } from "./HighlightedClinicalText";
import { PipelineLabPanel } from "./PipelineLabPanel";
import { SpecialtySelector } from "./SpecialtySelector";

const defaultText = sampleInputs["primary-care"];

export function ClinicalEntityExtractorPrototype() {
  const [text, setText] = useState(defaultText);
  const [contextMode, setContextMode] = useState<"auto" | "override">("auto");
  const [specialty, setSpecialty] = useState<Specialty>("mixed");
  const [entities, setEntities] = useState<ClinicalEntity[]>(() =>
    extractClinicalEntityDocument(defaultText, { mode: "auto" }).entities
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(entities[0]?.id ?? null);
  const [hasExtracted, setHasExtracted] = useState(true);
  const [selectedTextRange, setSelectedTextRange] = useState({ start: 0, end: 0 });
  const [manualEntityType, setManualEntityType] = useState<ClinicalEntityType>("problem");
  const [savedSession, setSavedSession] = useState<SavedExtractionSession | null>(() => loadLatestSession());
  const [savedSessions, setSavedSessions] = useState<SavedExtractionSession[]>([]);
  const [selectedSavedSessionId, setSelectedSavedSessionId] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    if (!globalThis.indexedDB) return;
    void refreshSavedSessions();
  }, []);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [entities, selectedEntityId]
  );
  const sections = useMemo(() => detectClinicalSections(text), [text]);
  const detectedContext = useMemo(() => detectClinicalContext(text), [text]);
  const documentSpecialty = contextMode === "auto" ? detectedContext.primarySpecialty : specialty;
  const selectedCodingCount = useMemo(
    () => entities.reduce((count, entity) => count + (entity.codings?.filter((coding) => coding.status === "selected").length ?? 0), 0),
    [entities]
  );
  const highPriorityCount = useMemo(
    () => entities.filter((entity) => entity.uncertainty?.reviewPriority === "high").length,
    [entities]
  );
  const reviewedEntityCount = useMemo(
    () => entities.filter((entity) => entity.review?.status && entity.review.status !== "unreviewed").length,
    [entities]
  );
  const selectedSourceText = text.slice(selectedTextRange.start, selectedTextRange.end).trim();

  function handleTextChange(nextText: string) {
    setText(nextText);

    if (!nextText.trim()) {
      setEntities([]);
      setSelectedEntityId(null);
      setSelectedTextRange({ start: 0, end: 0 });
      setHasExtracted(false);
    }
  }

  function handleExtract() {
    const nextEntities = extractClinicalEntityDocument(text, { specialty, mode: contextMode }).entities;
    setEntities(nextEntities);
    setSelectedEntityId(nextEntities[0]?.id ?? null);
    setHasExtracted(true);
  }

  function loadExample(nextSpecialty: Specialty) {
    setSpecialty(nextSpecialty);
    setContextMode("auto");
    setText(sampleInputs[nextSpecialty]);
    const nextEntities = extractClinicalEntityDocument(sampleInputs[nextSpecialty], { mode: "auto" }).entities;
    setEntities(nextEntities);
    setSelectedEntityId(nextEntities[0]?.id ?? null);
    setHasExtracted(true);
  }

  function loadEvalFixture(fixture: EvaluationFixture) {
    setSpecialty(fixture.specialty);
    setContextMode("auto");
    setText(fixture.text);
    const nextEntities = extractClinicalEntityDocument(fixture.text, { mode: "auto" }).entities;
    setEntities(nextEntities);
    setSelectedEntityId(nextEntities[0]?.id ?? null);
    setHasExtracted(true);
  }

  async function refreshSavedSessions() {
    const sessions = await listSavedSessions();
    setSavedSessions(sessions);
    setSelectedSavedSessionId((currentId) => currentId || sessions[0]?.id || "");
  }

  async function handleSaveSession() {
    if (!entities.length) return;
    const latest = saveLatestSession(text, specialty, entities);
    setSavedSession(latest);
    setSessionMessage("Session saved.");

    if (!globalThis.indexedDB) return;

    try {
      const librarySession = await saveSessionToLibrary(text, specialty, entities);
      setSavedSessions((currentSessions) => [
        librarySession,
        ...currentSessions.filter((session) => session.id !== librarySession.id)
      ]);
      setSelectedSavedSessionId(librarySession.id);
    } catch {
      setSavedSessions([]);
      setSelectedSavedSessionId("");
    }
  }

  async function handleImportSession(file: File | null) {
    if (!file) return;
    const result = importSavedSessionJson(await readFileText(file));

    if (!result.ok) {
      setSessionMessage(result.errors[0] ?? "Could not import session.");
      return;
    }

    setSavedSession(result.value);
    setText(result.value.sourceText);
    setSpecialty(result.value.specialty);
    setEntities(result.value.entities);
    setSelectedEntityId(result.value.entities[0]?.id ?? null);
    setHasExtracted(true);
    setSessionMessage(result.warnings.length ? `Imported with warning: ${result.warnings[0]}` : "Session imported.");

    if (!globalThis.indexedDB) return;
    try {
      const librarySession = await saveSessionToLibrary(result.value.sourceText, result.value.specialty, result.value.entities);
      setSavedSessions((currentSessions) => [
        librarySession,
        ...currentSessions.filter((session) => session.id !== librarySession.id)
      ]);
      setSelectedSavedSessionId(librarySession.id);
    } catch {
      setSelectedSavedSessionId("");
    }
  }

  async function handleRestoreSession() {
    const session = selectedSavedSessionId ? await loadSavedSession(selectedSavedSessionId) : loadLatestSession();
    const latest = session ?? loadLatestSession();
    if (!latest) return;

    setSavedSession(latest);
    setText(latest.sourceText);
    setSpecialty(latest.specialty);
    setEntities(latest.entities);
    setSelectedEntityId(latest.entities[0]?.id ?? null);
    setHasExtracted(true);
    setSessionMessage("Session restored.");
  }

  async function handleClearSavedSession() {
    if (selectedSavedSessionId) {
      try {
        await deleteSavedSession(selectedSavedSessionId);
      } catch {
        // Keep localStorage cleanup available even if IndexedDB is unavailable.
      }
      const nextSessions = savedSessions.filter((session) => session.id !== selectedSavedSessionId);
      setSavedSessions(nextSessions);
      setSelectedSavedSessionId(nextSessions[0]?.id ?? "");
    }

    clearLatestSession();
    setSavedSession(null);
    setSessionMessage("Saved session deleted.");
  }

  function handleCodingStatusChange(
    entityId: string,
    system: TerminologySystem,
    code: string,
    nextStatus: CodingStatus
  ) {
    setEntities((currentEntities) =>
      currentEntities.map((entity) => {
        if (entity.id !== entityId || !entity.codings) return entity;

        return {
          ...entity,
          codings: entity.codings.map((coding) => {
            const isTarget = coding.system === system && coding.code === code;
            const isSameSystem = coding.system === system;

            if (isTarget) return { ...coding, status: nextStatus };
            if (nextStatus === "selected" && isSameSystem && coding.status === "selected") {
              return { ...coding, status: "candidate" };
            }
            return coding;
          })
        };
      })
    );
  }

  function handleRelationStatusChange(
    entityId: string,
    relationType: EntityRelationType,
    targetEntityId: string,
    nextStatus: RelationStatus
  ) {
    setEntities((currentEntities) =>
      currentEntities.map((entity) => {
        if (entity.id !== entityId || !entity.relations) return entity;

        return {
          ...entity,
          relations: entity.relations.map((relation) =>
            relation.type === relationType && relation.targetEntityId === targetEntityId
              ? { ...relation, status: nextStatus }
              : relation
          )
        };
      })
    );
  }

  function handleEntityUpdate(
    entityId: string,
    updates: {
      displayName: string;
      type: ClinicalEntityType;
      assertion: AssertionStatus;
      confidence: Confidence;
      reviewNote: string;
    }
  ) {
    setEntities((currentEntities) =>
      currentEntities.map((entity) => {
        if (entity.id !== entityId) return entity;

        return {
          ...entity,
          displayName: updates.displayName,
          type: updates.type,
          confidence: updates.confidence,
          attributes: {
            ...entity.attributes,
            assertion: updates.assertion
          },
          review: {
            status: "edited",
            note: updates.reviewNote
          }
        };
      })
    );
  }

  function handleEntityReviewed(entityId: string, reviewNote: string) {
    setEntities((currentEntities) =>
      currentEntities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              review: {
                status: "reviewed",
                note: reviewNote
              }
            }
          : entity
      )
    );
  }

  function handleEntityDelete(entityId: string) {
    setEntities((currentEntities) => {
      const nextEntities = currentEntities.filter((entity) => entity.id !== entityId);
      if (selectedEntityId === entityId) {
        setSelectedEntityId(nextEntities[0]?.id ?? null);
      }
      return nextEntities;
    });
  }

  function handleAddSelectedEntity() {
    if (!selectedSourceText) return;

    const startOffset = text.indexOf(selectedSourceText, selectedTextRange.start);
    const start = startOffset >= 0 ? startOffset : selectedTextRange.start;
    const end = start + selectedSourceText.length;
    const manualEntity: ClinicalEntity = {
      id: `manual-${Date.now()}`,
      canonicalName: selectedSourceText.toLowerCase(),
      displayName: selectedSourceText,
      type: manualEntityType,
      specialties: [specialty],
      mentions: [
        {
          text: selectedSourceText,
          start,
          end,
          sentence: findContainingSentence(text, start, end),
          section: getSectionForOffset(sections, start)?.normalizedName
        }
      ],
      attributes: {
        assertion: "present",
        normalizedTerm: selectedSourceText.toLowerCase()
      },
      confidence: "medium",
      explanation: "Added manually by reviewer from selected source text.",
      review: {
        status: "manual"
      }
    };

    setEntities((currentEntities) => currentEntities.concat(manualEntity));
    setSelectedEntityId(manualEntity.id);
    setHasExtracted(true);
  }

  return (
    <main className="prototype-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Clinical text prototype</p>
          <h1>Structured entity extraction workbench</h1>
        </div>
        <div className="topbar-metrics" aria-label="Extraction summary">
          <div>
            <span>{entities.length}</span>
            entities
          </div>
          <div>
            <span>{selectedCodingCount}</span>
            selected codes
          </div>
          <div>
            <span>{reviewedEntityCount}</span>
            reviewed
          </div>
          <div>
            <span>{highPriorityCount}</span>
            high priority
          </div>
        </div>
      </header>

      <section className="workspace-grid">
        <section className="note-panel" aria-label="Input">
          <div className="panel-heading">
            <div>
              <h2>Input</h2>
              <p>Paste or type clinical text, then run local extraction.</p>
            </div>
            <Activity size={20} aria-hidden="true" />
          </div>

          <SpecialtySelector
            mode={contextMode}
            value={specialty}
            onChange={setSpecialty}
            onModeChange={setContextMode}
          />

          <section className="context-insight" aria-label="Detected clinical context">
            <div>
              <strong>{contextMode === "auto" ? "Auto context" : "Manual override"}</strong>
              <span>
                {contextMode === "auto"
                  ? `${specialtyLabels[detectedContext.primarySpecialty]} · ${detectedContext.noteType}`
                  : specialtyLabels[specialty]}
              </span>
            </div>
            <div className="context-score-row">
              {(["primary-care", "mental-health", "physical-therapy"] as Specialty[]).map((contextSpecialty) => (
                <span key={contextSpecialty}>
                  {specialtyLabels[contextSpecialty]} {detectedContext.specialtyScores[contextSpecialty]}
                </span>
              ))}
            </div>
            {(detectedContext.lexicalSignals.length > 0 || detectedContext.sectionSignals.length > 0) && (
              <div className="context-signal-row">
                {detectedContext.sectionSignals.concat(detectedContext.lexicalSignals).slice(0, 5).map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
            )}
            {detectedContext.ambiguityWarnings.length > 0 && (
              <div className="context-ambiguity-row">
                {detectedContext.ambiguityWarnings.slice(0, 3).map((warning) => (
                  <span key={warning.abbreviation}>
                    {warning.abbreviation}: {warning.chosenMeaning ?? "needs review"}
                  </span>
                ))}
              </div>
            )}
          </section>

          <label className="compact-select example-select">
            <span>Example note</span>
            <select
              aria-label="Example note"
              value=""
              onChange={(event) => {
                const nextSpecialty = event.currentTarget.value as Specialty;
                if (nextSpecialty) loadExample(nextSpecialty);
              }}
            >
              <option value="">Load a sample note...</option>
              {(Object.keys(sampleInputs) as Specialty[]).map((key) => (
                <option key={key} value={key}>
                  {specialtyLabels[key]}
                </option>
              ))}
            </select>
          </label>

          <ClinicalTextInput value={text} onChange={handleTextChange} onSelectionChange={(start, end) => setSelectedTextRange({ start, end })} />

          <div className="manual-entity-bar" aria-label="Manual entity add">
            <select
              aria-label="Manual entity type"
              value={manualEntityType}
              onChange={(event) => setManualEntityType(event.target.value as ClinicalEntityType)}
            >
              <option value="problem">problem</option>
              <option value="symptom">symptom</option>
              <option value="finding">finding</option>
              <option value="medication">medication</option>
              <option value="lab">lab</option>
              <option value="vital">vital</option>
              <option value="score">score</option>
              <option value="plan">plan</option>
              <option value="risk">risk</option>
              <option value="other">other</option>
            </select>
            <button className="ghost-button" type="button" onClick={handleAddSelectedEntity} disabled={!selectedSourceText}>
              Add selected entity
            </button>
          </div>

          <div className="case-session-bar" aria-label="Case session">
            <button className="secondary-button" type="button" onClick={() => void handleSaveSession()} disabled={!entities.length}>
              <Save size={15} aria-hidden="true" />
              Save session
            </button>
            <label className="file-button">
              <Upload size={15} aria-hidden="true" />
              Import JSON
              <input
                aria-label="Import session JSON"
                accept="application/json,.json"
                type="file"
                onChange={(event) => {
                  void handleImportSession(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {savedSessions.length > 0 && (
              <select
                aria-label="Saved session"
                className="session-select"
                value={selectedSavedSessionId}
                onChange={(event) => setSelectedSavedSessionId(event.target.value)}
              >
                {savedSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleRestoreSession()}
              disabled={!savedSession && !savedSessions.length}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Restore latest
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => void handleClearSavedSession()}
              disabled={!savedSession && !savedSessions.length}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete saved
            </button>
            <span>
              {sessionMessage ||
              (savedSession
                ? `Saved ${formatSavedAt(savedSession.savedAt)} · ${savedSessions.length} in browser library`
                : "No saved session")}
            </span>
          </div>

          <button className="extract-button" type="button" onClick={handleExtract}>
            <Sparkles size={18} aria-hidden="true" />
            Extract entities
          </button>

          <EvalLabPanel onLoadFixture={loadEvalFixture} />
          <PipelineLabPanel text={text} entities={entities} />
        </section>

        <section className="review-panel" aria-label="Output">
          <div className="panel-heading">
            <div>
              <h2>Output</h2>
              <p>Review extracted spans, entities, coding candidates, and exports.</p>
            </div>
            <ClipboardList size={20} aria-hidden="true" />
          </div>

          <div className="section-strip" aria-label="Detected sections">
            {sections
              .filter((section) => text.slice(section.start, section.end).trim())
              .map((section) => (
                <span key={section.id}>{getSectionLabel(section.normalizedName)}</span>
              ))}
          </div>

          <HighlightedClinicalText
            text={text}
            entities={entities}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />

          <ExtractedEntityPanel
            entities={entities}
            hasExtracted={hasExtracted}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />

          {entities.length > 0 && <DocumentOutputPanel text={text} specialty={documentSpecialty} entities={entities} />}
        </section>

        <EntityDetailPanel
          entity={selectedEntity}
          onCodingStatusChange={handleCodingStatusChange}
          onEntityDelete={handleEntityDelete}
          onEntityReviewed={handleEntityReviewed}
          onEntityUpdate={handleEntityUpdate}
          onRelationStatusChange={handleRelationStatusChange}
        />
      </section>
    </main>
  );
}

function findContainingSentence(text: string, start: number, end: number) {
  const sentenceStart = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("\n", start - 1), 0);
  const sentenceEndCandidates = [text.indexOf(".", end), text.indexOf("\n", end)].filter((index) => index >= 0);
  const sentenceEnd = sentenceEndCandidates.length ? Math.min(...sentenceEndCandidates) + 1 : text.length;
  return text.slice(sentenceStart === 0 ? 0 : sentenceStart + 1, sentenceEnd).trim();
}

function formatSavedAt(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function readFileText(file: File) {
  if (typeof file.text === "function") return file.text();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
