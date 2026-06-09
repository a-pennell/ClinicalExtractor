import { useEffect, useState } from "react";
import { AlertTriangle, Check, FileJson, Link2, MapPin, RotateCcw, Trash2, X } from "lucide-react";
import { buildFhirPreview } from "../../lib/clinical-extraction/fhirPreview";
import { getSectionLabel } from "../../lib/clinical-extraction/sectionParser";
import type {
  AssertionStatus,
  ClinicalEntity,
  ClinicalEntityType,
  CodingStatus,
  Confidence,
  EntityRelationType,
  RelationStatus,
  TerminologySystem
} from "../../lib/clinical-extraction/types";
import { TerminologyExplorerPanel } from "./TerminologyExplorerPanel";

type EntityDetailPanelProps = {
  entity: ClinicalEntity | null;
  onCodingStatusChange?: (
    entityId: string,
    system: TerminologySystem,
    code: string,
    status: CodingStatus
  ) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityReviewed?: (entityId: string, reviewNote: string) => void;
  onEntityUpdate?: (
    entityId: string,
    updates: {
      displayName: string;
      type: ClinicalEntityType;
      assertion: AssertionStatus;
      confidence: Confidence;
      reviewNote: string;
    }
  ) => void;
  onRelationStatusChange?: (
    entityId: string,
    relationType: EntityRelationType,
    targetEntityId: string,
    status: RelationStatus
  ) => void;
};

const entityTypeOptions: ClinicalEntityType[] = [
  "problem",
  "symptom",
  "finding",
  "medication",
  "allergy",
  "procedure",
  "lab",
  "vital",
  "score",
  "body-site",
  "laterality",
  "duration",
  "severity",
  "functional-limitation",
  "plan",
  "referral",
  "imaging",
  "exercise",
  "special-test",
  "risk",
  "other"
];

const assertionOptions: AssertionStatus[] = [
  "present",
  "absent",
  "possible",
  "historical",
  "family-history",
  "planned",
  "ordered"
];

const confidenceOptions: Confidence[] = ["high", "medium", "low"];

export function EntityDetailPanel({
  entity,
  onCodingStatusChange,
  onEntityDelete,
  onEntityReviewed,
  onEntityUpdate,
  onRelationStatusChange
}: EntityDetailPanelProps) {
  const [draft, setDraft] = useState({
    displayName: "",
    type: "other" as ClinicalEntityType,
    assertion: "present" as AssertionStatus,
    confidence: "medium" as Confidence,
    reviewNote: ""
  });

  useEffect(() => {
    if (!entity) return;

    setDraft({
      displayName: entity.displayName,
      type: entity.type,
      assertion: entity.attributes?.assertion ?? "present",
      confidence: entity.confidence,
      reviewNote: entity.review?.note ?? ""
    });
  }, [entity]);

  if (!entity) {
    return (
      <aside className="detail-panel">
        <div className="panel-heading compact">
          <h2>Entity detail</h2>
          <FileJson size={19} aria-hidden="true" />
        </div>
        <div className="empty-state detail-empty">
          <strong>No entity selected</strong>
          <span>Click a card or highlighted span to inspect source detail.</span>
        </div>
      </aside>
    );
  }

  const fhirPreview = buildFhirPreview(entity);

  return (
    <aside className="detail-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">{entity.type.replace(/-/g, " ")}</p>
          <h2>{entity.displayName}</h2>
        </div>
        <FileJson size={19} aria-hidden="true" />
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Canonical</dt>
          <dd>{entity.canonicalName}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{entity.confidence}</dd>
        </div>
        <div>
          <dt>Assertion</dt>
          <dd>{entity.attributes?.assertion ?? "present"}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{entity.review?.status ?? "unreviewed"}</dd>
        </div>
        <div>
          <dt>Section</dt>
          <dd>{getSectionLabel(entity.mentions[0]?.section)}</dd>
        </div>
        <div>
          <dt>Review priority</dt>
          <dd>{entity.uncertainty?.reviewPriority ?? "routine"}</dd>
        </div>
        {entity.attributes?.value && (
          <div>
            <dt>Value</dt>
            <dd>
              {entity.attributes.value}
              {entity.attributes.unit ? ` ${entity.attributes.unit}` : ""}
            </dd>
          </div>
        )}
        {entity.attributes?.dose && (
          <div>
            <dt>Dose</dt>
            <dd>{entity.attributes.dose}</dd>
          </div>
        )}
        {entity.attributes?.route && (
          <div>
            <dt>Route</dt>
            <dd>{entity.attributes.route}</dd>
          </div>
        )}
        {entity.attributes?.frequency && (
          <div>
            <dt>Frequency</dt>
            <dd>{entity.attributes.frequency}</dd>
          </div>
        )}
        {entity.attributes?.prn && (
          <div>
            <dt>PRN</dt>
            <dd>{entity.attributes.indication ? `as needed for ${entity.attributes.indication}` : "as needed"}</dd>
          </div>
        )}
        {entity.attributes?.sig && (
          <div>
            <dt>Sig</dt>
            <dd>{entity.attributes.sig}</dd>
          </div>
        )}
        {entity.attributes?.substance && (
          <div>
            <dt>Substance</dt>
            <dd>{entity.attributes.substance}</dd>
          </div>
        )}
        {entity.attributes?.reaction && (
          <div>
            <dt>Reaction</dt>
            <dd>{entity.attributes.reaction}</dd>
          </div>
        )}
        {entity.attributes?.familyMember && (
          <div>
            <dt>Family member</dt>
            <dd>{entity.attributes.familyMember}</dd>
          </div>
        )}
        {entity.attributes?.modality && (
          <div>
            <dt>Modality</dt>
            <dd>{entity.attributes.modality}</dd>
          </div>
        )}
        {entity.attributes?.bodySite && (
          <div>
            <dt>Body site</dt>
            <dd>{entity.attributes.bodySite}</dd>
          </div>
        )}
        {entity.attributes?.duration && (
          <div>
            <dt>Duration</dt>
            <dd>{entity.attributes.duration}</dd>
          </div>
        )}
        {entity.attributes?.laterality && (
          <div>
            <dt>Laterality</dt>
            <dd>{entity.attributes.laterality}</dd>
          </div>
        )}
      </dl>

      <section className="detail-section">
        <h3>Review</h3>
        <div className="review-form">
          <label className="review-field full">
            <span>Display name</span>
            <input
              value={draft.displayName}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
            />
          </label>
          <label className="review-field">
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({ ...current, type: event.target.value as ClinicalEntityType }))
              }
            >
              {entityTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="review-field">
            <span>Assertion</span>
            <select
              value={draft.assertion}
              onChange={(event) =>
                setDraft((current) => ({ ...current, assertion: event.target.value as AssertionStatus }))
              }
            >
              {assertionOptions.map((assertion) => (
                <option key={assertion} value={assertion}>
                  {assertion}
                </option>
              ))}
            </select>
          </label>
          <label className="review-field">
            <span>Confidence</span>
            <select
              value={draft.confidence}
              onChange={(event) =>
                setDraft((current) => ({ ...current, confidence: event.target.value as Confidence }))
              }
            >
              {confidenceOptions.map((confidence) => (
                <option key={confidence} value={confidence}>
                  {confidence}
                </option>
              ))}
            </select>
          </label>
          <label className="review-field full">
            <span>Reviewer note</span>
            <textarea
              className="review-note"
              rows={3}
              value={draft.reviewNote}
              onChange={(event) => setDraft((current) => ({ ...current, reviewNote: event.target.value }))}
            />
          </label>
          <div className="review-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEntityUpdate?.(entity.id, draft)}
            >
              <Check size={15} aria-hidden="true" />
              Save edits
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEntityReviewed?.(entity.id, draft.reviewNote)}
            >
              <Check size={15} aria-hidden="true" />
              Mark reviewed
            </button>
            <button className="danger-button" type="button" onClick={() => onEntityDelete?.(entity.id)}>
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      </section>

      {entity.uncertainty?.reasons.length ? (
        <section className="detail-section">
          <h3>Review cues</h3>
          <div className="cue-list">
            {entity.uncertainty.reasons.map((reason) => (
              <div className="cue-row" key={reason}>
                <AlertTriangle size={15} aria-hidden="true" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entity.disambiguation && (
        <section className="detail-section">
          <h3>Abbreviation resolution</h3>
          <div className="cue-list">
            <div className="cue-row neutral">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                {entity.disambiguation.abbreviation}
                {entity.disambiguation.chosenMeaning ? ` -> ${entity.disambiguation.chosenMeaning}` : " needs review"}
                {entity.disambiguation.reason ? ` · ${entity.disambiguation.reason}` : ""}
                {entity.disambiguation.evidence?.length ? ` Evidence: ${entity.disambiguation.evidence.join(", ")}.` : ""}
                {entity.disambiguation.mentionCount ? ` Mentions: ${entity.disambiguation.mentionCount}.` : ""}
                {entity.disambiguation.source ? ` Source: ${entity.disambiguation.source}.` : ""}
              </span>
            </div>
          </div>
        </section>
      )}

      {entity.relations?.length ? (
        <section className="detail-section">
          <h3>Linked entities</h3>
          <div className="relation-list">
            {entity.relations.map((relation) => (
              <div className={`relation-row relation-${relation.status}`} key={`${relation.type}-${relation.targetEntityId}`}>
                <Link2 size={15} aria-hidden="true" />
                <div>
                  <strong>
                    {relation.type.replace(/-/g, " ")}: {relation.targetDisplayName}
                  </strong>
                  <span>
                    {relation.confidence} confidence · {relation.status}
                  </span>
                  <p>{relation.explanation}</p>
                </div>
                <div className="icon-button-row" aria-label={`${relation.type} ${relation.targetDisplayName} relation review actions`}>
                  <button
                    aria-label={`Accept relation to ${relation.targetDisplayName}`}
                    className={relation.status === "accepted" ? "icon-button is-active" : "icon-button"}
                    title="Accept relation"
                    type="button"
                    onClick={() => onRelationStatusChange?.(entity.id, relation.type, relation.targetEntityId, "accepted")}
                  >
                    <Check size={14} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Reject relation to ${relation.targetDisplayName}`}
                    className={relation.status === "rejected" ? "icon-button is-danger is-active" : "icon-button is-danger"}
                    title="Reject relation"
                    type="button"
                    onClick={() => onRelationStatusChange?.(entity.id, relation.type, relation.targetEntityId, "rejected")}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Reset relation to ${relation.targetDisplayName}`}
                    className="icon-button"
                    title="Reset relation"
                    type="button"
                    onClick={() => onRelationStatusChange?.(entity.id, relation.type, relation.targetEntityId, "candidate")}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entity.codings?.length ? (
        <section className="detail-section">
          <h3>Candidate codes</h3>
          <div className="coding-list">
            {entity.codings.map((coding) => (
              <div className={`coding-row coding-${coding.status}`} key={`${coding.system}-${coding.code}`}>
                <div>
                  <strong>
                    {coding.system} {coding.code}
                  </strong>
                  <span>{coding.display}</span>
                  {coding.rationale && <p>{coding.rationale}</p>}
                </div>
                <div className="coding-actions">
                  <span className={`confidence-pill confidence-${coding.confidence}`}>{coding.confidence}</span>
                  <div className="icon-button-row" aria-label={`${coding.system} ${coding.code} review actions`}>
                    <button
                      aria-label={`Select ${coding.system} ${coding.code}`}
                      className={coding.status === "selected" ? "icon-button is-active" : "icon-button"}
                      title="Select code"
                      type="button"
                      onClick={() => onCodingStatusChange?.(entity.id, coding.system, coding.code, "selected")}
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Reject ${coding.system} ${coding.code}`}
                      className={coding.status === "rejected" ? "icon-button is-danger is-active" : "icon-button is-danger"}
                      title="Reject code"
                      type="button"
                      onClick={() => onCodingStatusChange?.(entity.id, coding.system, coding.code, "rejected")}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Reset ${coding.system} ${coding.code}`}
                      className="icon-button"
                      title="Reset to candidate"
                      type="button"
                      onClick={() => onCodingStatusChange?.(entity.id, coding.system, coding.code, "candidate")}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <span className={`coding-status status-${coding.status}`}>{coding.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="detail-section">
          <h3>Candidate codes</h3>
          <p>No local terminology candidate yet.</p>
        </section>
      )}

      <details className="detail-section advanced-disclosure">
        <summary>Terminology lookup</summary>
        <TerminologyExplorerPanel entity={entity} />
      </details>

      <section className="detail-section">
        <h3>Mentions</h3>
        {entity.mentions.map((mention) => (
          <div className="mention-row" key={`${mention.start}-${mention.end}`}>
            <MapPin size={15} aria-hidden="true" />
            <div>
              <strong>{mention.text}</strong>
              <span>
                chars {mention.start}-{mention.end}
                {mention.section ? ` · ${getSectionLabel(mention.section)}` : ""}
              </span>
              {mention.sentence && <p>{mention.sentence}</p>}
            </div>
          </div>
        ))}
      </section>

      {entity.explanation && (
        <section className="detail-section">
          <h3>Why it matched</h3>
          <p>{entity.explanation}</p>
        </section>
      )}

      <details className="detail-section advanced-disclosure">
        <summary>FHIR preview</summary>
        <pre>{JSON.stringify(fhirPreview, null, 2)}</pre>
      </details>

      <details className="detail-section advanced-disclosure">
        <summary>Structured object</summary>
        <pre>{JSON.stringify(entity, null, 2)}</pre>
      </details>
    </aside>
  );
}
