import { useState } from "react";
import { Copy, Download, FileText, Share2 } from "lucide-react";
import {
  buildClipboardSummary,
  buildExtractionSession,
  buildFhirBundle,
  buildReviewerReport
} from "../../lib/clinical-extraction/documentOutput";
import { validateFhirBundleQuality } from "../../lib/clinical-extraction/schemaValidation";
import type { ClinicalEntity, Specialty } from "../../lib/clinical-extraction/types";

type DocumentOutputPanelProps = {
  text: string;
  specialty: Specialty;
  entities: ClinicalEntity[];
};

export function DocumentOutputPanel({ text, specialty, entities }: DocumentOutputPanelProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const session = buildExtractionSession(text, specialty, entities);
  const bundle = buildFhirBundle(entities);
  const reviewerReport = buildReviewerReport(text, specialty, entities);
  const clipboardSummary = buildClipboardSummary(entities);
  const fhirQuality = validateFhirBundleQuality(bundle);
  const sessionJson = JSON.stringify(session, null, 2);
  const bundleJson = JSON.stringify(bundle, null, 2);
  const typeEntries = Object.entries(session.summary.byType).sort(([a], [b]) => a.localeCompare(b));
  const fhirTypeEntries = Object.entries(fhirQuality.summary.resourceTypes).sort(([a], [b]) => a.localeCompare(b));
  const usedTerminologySystems = session.terminology.systems.filter(
    (system) => system.candidateCount > 0 || system.selectedCount > 0
  );

  function copyText(label: string, contents: string) {
    void navigator.clipboard?.writeText(contents);
    setCopyStatus(`${label} copied`);
  }

  function shareReport() {
    if (!navigator.share) {
      copyText("Review report", reviewerReport);
      return;
    }

    void navigator.share({
      title: "Clinical Entity Extraction Review",
      text: reviewerReport
    });
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
        <div className="terminology-manifest">
          <strong>
            {session.terminology.provider.label} · {session.terminology.provider.contentVersion}
          </strong>
          <div>
            {usedTerminologySystems.length ? (
              usedTerminologySystems.map((system) => (
                <span key={system.system}>
                  {system.system} {system.version}: {system.candidateCount} candidates
                </span>
              ))
            ) : (
              <span>No terminology candidates in this extraction.</span>
            )}
          </div>
        </div>
        <div className={`fhir-quality ${fhirQuality.ok ? "pass" : "fail"}`} aria-label="FHIR quality">
          <div>
            <strong>FHIR quality</strong>
            <span>{fhirQuality.ok ? "Local checks passed" : "Needs attention"}</span>
          </div>
          <div>
            <span>{fhirQuality.summary.resourceCount} resources</span>
            {fhirTypeEntries.map(([resourceType, count]) => (
              <span key={resourceType}>
                {resourceType}: {count}
              </span>
            ))}
            <span>{fhirQuality.errors.length} errors</span>
            <span>{fhirQuality.warnings.length} warnings</span>
          </div>
          {(fhirQuality.errors.length > 0 || fhirQuality.warnings.length > 0) && (
            <ul>
              {fhirQuality.errors.concat(fhirQuality.warnings).slice(0, 4).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="review-actions export-actions" aria-label="Export and share actions">
          <button className="secondary-button" type="button" onClick={() => copyText("Session JSON", sessionJson)}>
            <Copy size={15} aria-hidden="true" />
            Copy JSON
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadFile("clinical-entity-session.json", sessionJson, "application/json")}>
            <Download size={15} aria-hidden="true" />
            Download JSON
          </button>
          <button className="secondary-button" type="button" onClick={() => copyText("FHIR bundle", bundleJson)}>
            <Copy size={15} aria-hidden="true" />
            Copy FHIR
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadFile("clinical-entity-fhir-bundle.json", bundleJson, "application/json")}>
            <Download size={15} aria-hidden="true" />
            Download FHIR
          </button>
          <button className="secondary-button" type="button" onClick={() => copyText("Entity summary", clipboardSummary)}>
            <FileText size={15} aria-hidden="true" />
            Copy summary
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadFile("clinical-entity-review.md", reviewerReport, "text/markdown")}>
            <Download size={15} aria-hidden="true" />
            Download report
          </button>
          <button className="secondary-button" type="button" onClick={shareReport}>
            <Share2 size={15} aria-hidden="true" />
            Share report
          </button>
        </div>
        {copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}
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

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
