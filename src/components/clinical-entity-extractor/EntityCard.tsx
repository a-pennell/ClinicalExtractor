import { AlertCircle, AlertTriangle, CheckCircle2, CircleDot, Link2, MinusCircle } from "lucide-react";
import type { ClinicalEntity } from "../../lib/clinical-extraction/types";

type EntityCardProps = {
  entity: ClinicalEntity;
  isSelected: boolean;
  onSelect: () => void;
};

export function EntityCard({ entity, isSelected, onSelect }: EntityCardProps) {
  const assertion = entity.attributes?.assertion ?? "present";
  const reviewStatus = entity.review?.status ?? "unreviewed";
  const reviewPriority = entity.uncertainty?.reviewPriority ?? "routine";
  const relationCount = entity.relations?.length ?? 0;

  return (
    <button className={`entity-card ${isSelected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="entity-card-main">
        <span className="entity-title">{entity.displayName}</span>
        <span className="entity-meta">
          {entity.confidence} confidence · {entity.mentions.length} mention{entity.mentions.length === 1 ? "" : "s"}
        </span>
      </span>
      <span className={`status-chip status-${assertion}`}>
        {assertionIcon(assertion)}
        {assertion}
      </span>
      {reviewPriority !== "routine" && (
        <span className={`uncertainty-chip priority-${reviewPriority}`}>
          <AlertTriangle size={14} aria-hidden="true" />
          {reviewPriority}
        </span>
      )}
      {relationCount > 0 && (
        <span className="relation-chip">
          <Link2 size={14} aria-hidden="true" />
          {relationCount} link{relationCount === 1 ? "" : "s"}
        </span>
      )}
      <span className={`review-chip review-${reviewStatus}`}>{reviewStatus}</span>
    </button>
  );
}

function assertionIcon(assertion: string) {
  if (assertion === "absent") return <MinusCircle size={14} aria-hidden="true" />;
  if (assertion === "ordered" || assertion === "planned") return <CircleDot size={14} aria-hidden="true" />;
  if (assertion === "possible") return <AlertCircle size={14} aria-hidden="true" />;
  return <CheckCircle2 size={14} aria-hidden="true" />;
}
