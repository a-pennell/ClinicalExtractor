import { useEffect, useState } from "react";
import { Search, Stethoscope } from "lucide-react";
import {
  expandWithAsyncTerminologyProvider,
  lookupWithAsyncTerminologyProvider
} from "../../lib/clinical-extraction/terminologyProviders";
import type { CandidateCoding, ClinicalEntity, TerminologySystem } from "../../lib/clinical-extraction/types";

type TerminologyExplorerPanelProps = {
  entity: ClinicalEntity;
};

const systemOptions: Array<TerminologySystem | "all"> = ["all", "ICD-10-CM", "SNOMED-CT", "LOINC", "RxNorm", "CPT", "HCPCS"];

export function TerminologyExplorerPanel({ entity }: TerminologyExplorerPanelProps) {
  const [searchTerm, setSearchTerm] = useState(entity.displayName);
  const [system, setSystem] = useState<TerminologySystem | "all">("all");
  const [resultLabel, setResultLabel] = useState("No terminology request yet.");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CandidateCoding[]>([]);

  useEffect(() => {
    setSearchTerm(entity.displayName);
    setResultLabel("No terminology request yet.");
    setWarnings([]);
    setCandidates([]);
  }, [entity.id, entity.displayName]);

  async function handleLookup() {
    const result = await lookupWithAsyncTerminologyProvider({
      operation: "$lookup",
      canonicalName: entity.canonicalName,
      type: entity.type,
      attributes: entity.attributes,
      specialty: entity.specialties[0],
      preferredSystems: system === "all" ? undefined : [system]
    });

    setResultLabel(`$lookup · ${entity.displayName}`);
    setWarnings(result.warnings ?? []);
    setCandidates(result.candidates);
  }

  async function handleExpand() {
    const result = await expandWithAsyncTerminologyProvider({
      operation: "$expand",
      filter: searchTerm,
      system: system === "all" ? undefined : system,
      limit: 8
    });

    setResultLabel(`$expand · ${result.filter}`);
    setWarnings(result.warnings ?? []);
    setCandidates(result.candidates);
  }

  return (
    <div className="terminology-explorer">
      <div className="terminology-controls">
        <label className="review-field full">
          <span>Search term</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </label>
        <label className="review-field">
          <span>System</span>
          <select value={system} onChange={(event) => setSystem(event.target.value as TerminologySystem | "all")}>
            {systemOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="review-actions">
          <button className="secondary-button" type="button" onClick={handleLookup}>
            <Stethoscope size={15} aria-hidden="true" />
            Lookup entity
          </button>
          <button className="secondary-button" type="button" onClick={handleExpand} disabled={!searchTerm.trim()}>
            <Search size={15} aria-hidden="true" />
            Search terminology
          </button>
        </div>
      </div>
      <div className="terminology-results">
        <strong>{resultLabel}</strong>
        {warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        {candidates.length ? (
          <div className="coding-list">
            {candidates.map((coding) => (
              <div className="coding-row" key={`${coding.system}-${coding.code}`}>
                <div>
                  <strong>
                    {coding.system} {coding.code}
                  </strong>
                  <span>{coding.display}</span>
                </div>
                <span className={`confidence-pill confidence-${coding.confidence}`}>{coding.confidence}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>No mock terminology candidates returned.</p>
        )}
      </div>
    </div>
  );
}
