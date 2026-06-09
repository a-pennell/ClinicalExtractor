import { useMemo, useState } from "react";
import { GitBranch, ShieldCheck } from "lucide-react";
import {
  buildPipelineLabSnapshot,
  type PipelineMode,
  type PipelineMetricRow
} from "../../lib/clinical-extraction/pipelineLab";
import type { ClinicalEntity } from "../../lib/clinical-extraction/types";

type PipelineLabPanelProps = {
  text: string;
  entities: ClinicalEntity[];
};

const modeOptions: { mode: PipelineMode; label: string; description: string }[] = [
  {
    mode: "rules",
    label: "Rules",
    description: "Deterministic extraction only."
  },
  {
    mode: "llm",
    label: "LLM",
    description: "Routes all extraction to structured LLM output."
  },
  {
    mode: "hybrid",
    label: "Hybrid",
    description: "Rules first, LLM for ambiguous or complex context."
  }
];

export function PipelineLabPanel({ text, entities }: PipelineLabPanelProps) {
  const [mode, setMode] = useState<PipelineMode>("hybrid");
  const snapshot = useMemo(() => buildPipelineLabSnapshot(text, entities), [text, entities]);
  const activeMode = modeOptions.find((option) => option.mode === mode) ?? modeOptions[0];

  return (
    <details className="pipeline-lab-panel">
      <summary className="pipeline-lab-summary">
        <div>
          <h2>Pipeline lab</h2>
          <p>
            {activeMode.label} preview · {snapshot.ruleHandledCount} rule spans · {snapshot.llmEscalationCount} LLM candidates
          </p>
        </div>
        <GitBranch size={19} aria-hidden="true" />
      </summary>

      <div className="pipeline-lab-body">
        <div className="mode-switch" aria-label="Extraction mode preview">
          {modeOptions.map((option) => (
            <button
              className={mode === option.mode ? "active" : ""}
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="pipeline-note">{activeMode.description} This preview does not change the clinician-facing extraction flow.</p>

        <div className="pipeline-score-grid" aria-label="Pipeline metrics">
          {snapshot.metrics.map((row) => (
            <MetricCard key={row.mode} row={row} />
          ))}
        </div>

        <section className="pipeline-section" aria-label="Triage preview">
          <div className="pipeline-section-heading">
            <h3>Triage preview</h3>
            <span>{snapshot.llmEscalationCount} escalations</span>
          </div>
          <div className="pipeline-route-list">
            {snapshot.triageBlocks.slice(0, 8).map((block) => (
              <div className="pipeline-route-row" key={block.id}>
                <span className={`route-pill route-${block.route.toLowerCase()}`}>{block.route}</span>
                <div>
                  <strong>{block.reason}</strong>
                  <p>{block.excerpt}</p>
                </div>
              </div>
            ))}
            {!snapshot.triageBlocks.length && <p>No routing events yet. Run extraction to populate the pipeline preview.</p>}
          </div>
        </section>

        <section className="pipeline-section" aria-label="Validation preview">
          <div className="pipeline-section-heading">
            <h3>Validation</h3>
            <span>{snapshot.validationIssues.length ? `${snapshot.validationIssues.length} issues` : "checks passed"}</span>
          </div>
          {snapshot.validationIssues.length ? (
            <div className="pipeline-token-list">
              {snapshot.validationIssues.slice(0, 6).map((issue) => (
                <span className={`pipeline-token ${issue.severity}`} key={`${issue.entityId}-${issue.message}`}>
                  {issue.label}: {issue.message}
                </span>
              ))}
            </div>
          ) : (
            <p className="pipeline-empty">
              <ShieldCheck size={15} aria-hidden="true" />
              Plausibility checks passed for currently extracted structured values.
            </p>
          )}
        </section>

        <section className="pipeline-section" aria-label="Feature matrix preview">
          <div className="pipeline-section-heading">
            <h3>Feature matrix preview</h3>
            <span>{snapshot.featureRows.length} features</span>
          </div>
          <div className="feature-preview-table">
            {snapshot.featureRows.map((row) => (
              <div className="feature-preview-row" key={row.feature}>
                <strong>{row.feature}</strong>
                <span>{formatFeatureValue(row.value)}</span>
                <p>{row.meaning}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pipeline-section" aria-label="LLM context compression preview">
          <div className="pipeline-section-heading">
            <h3>LLM context</h3>
            <span>{snapshot.compressedContext.length} chars</span>
          </div>
          <pre className="pipeline-context-preview">{snapshot.compressedContext || "No source text selected for LLM routing."}</pre>
        </section>
      </div>
    </details>
  );
}

function MetricCard({ row }: { row: PipelineMetricRow }) {
  return (
    <div className="pipeline-metric-card">
      <strong>{row.mode}</strong>
      <span>{row.f1 !== undefined ? `${formatPercent(row.f1)} F1` : row.rocAuc !== undefined ? `${formatPercent(row.rocAuc)} ROC` : "Pending"}</span>
      <p>
        {row.precision !== undefined && row.recall !== undefined
          ? `${formatPercent(row.precision)} precision · ${formatPercent(row.recall)} recall`
          : row.status}
      </p>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatFeatureValue(value: string | number | boolean | null) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}
