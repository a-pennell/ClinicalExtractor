import { useMemo, useState } from "react";
import { FlaskConical, ListChecks } from "lucide-react";
import {
  buildCoverageBacklog,
  buildEvaluationCoverageDashboard,
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
  const coverageDashboard = useMemo(() => buildEvaluationCoverageDashboard(evaluationFixtures), []);

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

      <section className="coverage-dashboard" aria-label="Coverage dashboard">
        <div className="coverage-dashboard-header">
          <h3>Coverage dashboard</h3>
          <span>
            {coverageDashboard.totalMatched}/{coverageDashboard.totalExpected} expected · {coverageDashboard.totalExtra} extra
          </span>
        </div>

        <div className="coverage-table" role="table" aria-label="Recall by specialty">
          <div className="coverage-row coverage-row-header" role="row">
            <span>Context</span>
            <span>Recall</span>
            <span>Missed</span>
            <span>Extra</span>
          </div>
          {coverageDashboard.bySpecialty.map((row) => (
            <div className="coverage-row" role="row" key={row.key}>
              <span>{specialtyLabels[row.key]}</span>
              <span>{Math.round((row.recall ?? 0) * 100)}%</span>
              <span>{row.missedCount ?? 0}</span>
              <span>{row.extraCount ?? 0}</span>
            </div>
          ))}
        </div>

        <CoverageBarList
          title="Entity mix"
          rows={coverageDashboard.byEntityType.slice(0, 7).map((row) => ({
            label: row.key.replace(/-/g, " "),
            value: row.foundCount ?? 0,
            sublabel: `${row.codedEntityCount ?? 0} coded`
          }))}
        />

        <CoverageBarList
          title="Assertion mix"
          rows={coverageDashboard.byAssertion.map((row) => ({
            label: row.key.replace(/-/g, " "),
            value: row.foundCount ?? 0
          }))}
        />

        <CoverageBarList
          title="Terminology"
          rows={coverageDashboard.byTerminologySystem.map((row) => ({
            label: row.key,
            value: row.candidateCount ?? 0,
            sublabel: `${row.codedEntityCount ?? 0} entities`
          }))}
        />

        {coverageDashboard.noteHotspots.length > 0 && (
          <section className="coverage-hotspots">
            <h3>Review hotspots</h3>
            <div className="eval-token-list">
              {coverageDashboard.noteHotspots.slice(0, 5).map((caseResult) => (
                <span className="eval-token warning" key={caseResult.id}>
                  {caseResult.id} · {caseResult.missedCanonicalNames.length} missed · {caseResult.extraCanonicalNames.length} extra
                </span>
              ))}
            </div>
          </section>
        )}
      </section>

      <label className="compact-select">
        <span>Eval context</span>
        <select
          aria-label="Eval context filter"
          value={filter}
          onChange={(event) => handleFilterChange(event.currentTarget.value as Specialty | "all")}
        >
          {filterOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All contexts" : specialtyLabels[option]}
            </option>
          ))}
        </select>
      </label>

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

function CoverageBarList({
  title,
  rows
}: {
  title: string;
  rows: { label: string; value: number; sublabel?: string }[];
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="coverage-bar-section">
      <h3>{title}</h3>
      <div className="coverage-bars">
        {rows.length ? (
          rows.map((row) => (
            <div className="coverage-bar-row" key={row.label}>
              <div>
                <span>{row.label}</span>
                <strong>
                  {row.value}
                  {row.sublabel ? ` · ${row.sublabel}` : ""}
                </strong>
              </div>
              <div className="coverage-bar-track" aria-hidden="true">
                <span style={{ width: `${Math.max((row.value / maxValue) * 100, 4)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p>No coverage rows yet.</p>
        )}
      </div>
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
