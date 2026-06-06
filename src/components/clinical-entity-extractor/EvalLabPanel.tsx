import { useMemo, useState } from "react";
import { FlaskConical, ListChecks } from "lucide-react";
import {
  buildCoverageBacklog,
  evaluateFixture,
  evaluateExtractionFixtures,
  evaluationFixtures,
  type EvaluationFixture
} from "../../lib/clinical-extraction/evaluationFixtures";
import { specialtyLabels } from "../../lib/clinical-extraction/specialtyProfiles";
import type { Specialty } from "../../lib/clinical-extraction/types";

type EvalLabPanelProps = {
  onLoadFixture: (fixture: EvaluationFixture) => void;
};

const filterOptions: Array<Specialty | "all"> = ["all", "primary-care", "mental-health", "physical-therapy", "mixed"];

export function EvalLabPanel({ onLoadFixture }: EvalLabPanelProps) {
  const [filter, setFilter] = useState<Specialty | "all">("all");
  const [selectedFixtureId, setSelectedFixtureId] = useState(evaluationFixtures[0]?.id ?? "");
  const filteredFixtures = useMemo(
    () => evaluationFixtures.filter((fixture) => filter === "all" || fixture.specialty === filter),
    [filter]
  );
  const selectedFixture =
    evaluationFixtures.find((fixture) => fixture.id === selectedFixtureId) ?? filteredFixtures[0] ?? evaluationFixtures[0];
  const overallResult = useMemo(() => evaluateExtractionFixtures(evaluationFixtures), []);
  const selectedResult = selectedFixture ? evaluateFixture(selectedFixture) : null;
  const backlog = buildCoverageBacklog(overallResult);

  function handleFilterChange(nextFilter: Specialty | "all") {
    setFilter(nextFilter);
    const nextFixture = evaluationFixtures.find((fixture) => nextFilter === "all" || fixture.specialty === nextFilter);
    if (nextFixture) setSelectedFixtureId(nextFixture.id);
  }

  if (!selectedFixture || !selectedResult) return null;

  return (
    <section className="eval-lab-panel" aria-label="Eval lab">
      <div className="panel-heading compact">
        <div>
          <h2>Eval lab</h2>
          <p>Synthetic notes with expected entities for coverage review.</p>
        </div>
        <FlaskConical size={19} aria-hidden="true" />
      </div>

      <div className="eval-summary">
        <div>
          <strong>{evaluationFixtures.length}</strong>
          mock notes
        </div>
        <div>
          <strong>{Math.round(overallResult.recall * 100)}%</strong>
          recall
        </div>
        <div>
          <strong>{backlog.length}</strong>
          coverage gaps
        </div>
      </div>

      <div className="eval-filter-row" aria-label="Eval context filter">
        {filterOptions.map((option) => (
          <button
            className={filter === option ? "ghost-button is-active" : "ghost-button"}
            key={option}
            type="button"
            onClick={() => handleFilterChange(option)}
          >
            {option === "all" ? "All" : specialtyLabels[option]}
          </button>
        ))}
      </div>

      <label className="review-field full">
        <span>Eval note</span>
        <select value={selectedFixture.id} onChange={(event) => setSelectedFixtureId(event.target.value)}>
          {filteredFixtures.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>
              {fixture.id}
            </option>
          ))}
        </select>
      </label>

      <div className="eval-note-preview">
        <span>{specialtyLabels[selectedFixture.specialty]}</span>
        <p>{selectedFixture.text}</p>
      </div>

      <div className="eval-summary compact">
        <div>
          <strong>{selectedResult.matchedCount}/{selectedResult.expectedCount}</strong>
          found
        </div>
        <div>
          <strong>{Math.round(selectedResult.recall * 100)}%</strong>
          note recall
        </div>
        <div>
          <strong>{selectedResult.extraCanonicalNames.length}</strong>
          extra
        </div>
      </div>

      <div className="review-actions">
        <button className="secondary-button" type="button" onClick={() => onLoadFixture(selectedFixture)}>
          <ListChecks size={15} aria-hidden="true" />
          Load eval note
        </button>
      </div>

      <EvalTokenList title="Expected" values={selectedResult.expectedCanonicalNames} tone="neutral" />
      <EvalTokenList title="Found" values={selectedResult.foundCanonicalNames} tone="positive" />
      <EvalTokenList title="Missed" values={selectedResult.missedCanonicalNames} tone="danger" emptyText="No misses" />
      <EvalTokenList title="Extra" values={selectedResult.extraCanonicalNames} tone="warning" emptyText="No extras" />

      <section className="coverage-backlog">
        <h3>Coverage backlog</h3>
        {backlog.length ? (
          <div className="eval-token-list">
            {backlog.map((item) => (
              <span className="eval-token danger" key={`${item.fixtureId}-${item.canonicalName}`}>
                {specialtyLabels[item.specialty]} · {item.canonicalName}
              </span>
            ))}
          </div>
        ) : (
          <p>No expected-entity misses in the synthetic set.</p>
        )}
      </section>
    </section>
  );
}

function EvalTokenList({
  title,
  values,
  tone,
  emptyText = "None"
}: {
  title: string;
  values: string[];
  tone: "neutral" | "positive" | "warning" | "danger";
  emptyText?: string;
}) {
  return (
    <section className="eval-token-section">
      <h3>{title}</h3>
      <div className="eval-token-list">
        {values.length ? values.map((value) => <span className={`eval-token ${tone}`} key={value}>{value}</span>) : <span>{emptyText}</span>}
      </div>
    </section>
  );
}
