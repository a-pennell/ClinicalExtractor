import { Copy, Download } from "lucide-react";
import { buildExtractionSession, buildFhirBundle } from "../../lib/clinical-extraction/documentOutput";
import type { ClinicalEntity, Specialty } from "../../lib/clinical-extraction/types";

type DocumentOutputPanelProps = {
  text: string;
  specialty: Specialty;
  entities: ClinicalEntity[];
};

export function DocumentOutputPanel({ text, specialty, entities }: DocumentOutputPanelProps) {
  const session = buildExtractionSession(text, specialty, entities);
  const bundle = buildFhirBundle(entities);
  const sessionJson = JSON.stringify(session, null, 2);
  const bundleJson = JSON.stringify(bundle, null, 2);
  const typeEntries = Object.entries(session.summary.byType).sort(([a], [b]) => a.localeCompare(b));

  function copySessionJson() {
    void navigator.clipboard?.writeText(sessionJson);
  }

  function downloadSessionJson() {
    downloadJson("clinical-entity-session.json", sessionJson);
  }

  return (
    <section className="document-output" aria-label="Document output">
      <div className="entity-group">
        <h3>
          <span>document output</span>
          <small>{session.summary.entityCount}</small>
        </h3>
        <div className="summary-strip">
          <div>
            <strong>{session.summary.reviewedCount}</strong>
            reviewed
          </div>
          <div>
            <strong>{session.summary.selectedCodingCount}</strong>
            selected codes
          </div>
          <div>
            <strong>{bundle.entry.length}</strong>
            FHIR entries
          </div>
          <div>
            <strong>{session.summary.relationCount}</strong>
            links
          </div>
          <div>
            <strong>{session.summary.highPriorityReviewCount}</strong>
            high priority
          </div>
        </div>
        {typeEntries.length > 0 && (
          <div className="type-summary">
            {typeEntries.map(([type, count]) => (
              <span key={type}>
                {type}: {count}
              </span>
            ))}
          </div>
        )}
        <div className="review-actions">
          <button className="secondary-button" type="button" onClick={copySessionJson}>
            <Copy size={15} aria-hidden="true" />
            Copy JSON
          </button>
          <button className="secondary-button" type="button" onClick={downloadSessionJson}>
            <Download size={15} aria-hidden="true" />
            Download JSON
          </button>
        </div>
        <details className="json-disclosure">
          <summary>Session JSON</summary>
          <pre>{sessionJson}</pre>
        </details>
        <details className="json-disclosure">
          <summary>FHIR Bundle</summary>
          <pre>{bundleJson}</pre>
        </details>
      </div>
    </section>
  );
}

function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
