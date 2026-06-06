import type React from "react";
import type { ClinicalEntity } from "../../lib/clinical-extraction/types";

type HighlightedClinicalTextProps = {
  text: string;
  entities: ClinicalEntity[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
};

type SpanMarker = {
  start: number;
  end: number;
  text: string;
  entity: ClinicalEntity;
};

export function HighlightedClinicalText({
  text,
  entities,
  selectedEntityId,
  onSelectEntity
}: HighlightedClinicalTextProps) {
  const spans = buildNonOverlappingSpans(entities);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span) => {
    if (span.start > cursor) {
      nodes.push(<span key={`text-${cursor}`}>{text.slice(cursor, span.start)}</span>);
    }

    nodes.push(
      <button
        className={`text-highlight type-${span.entity.type} ${
          span.entity.id === selectedEntityId ? "is-selected" : ""
        } ${span.entity.attributes?.assertion === "absent" ? "is-absent" : ""}`}
        key={`${span.entity.id}-${span.start}`}
        type="button"
        onClick={() => onSelectEntity(span.entity.id)}
        title={span.entity.displayName}
      >
        {text.slice(span.start, span.end)}
      </button>
    );
    cursor = span.end;
  });

  if (cursor < text.length) {
    nodes.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return (
    <div className="highlight-box">
      {text.trim() ? nodes : <span className="muted">No source text yet.</span>}
    </div>
  );
}

function buildNonOverlappingSpans(entities: ClinicalEntity[]): SpanMarker[] {
  const all = entities.flatMap((entity) =>
    entity.mentions.map((mention) => ({
      start: mention.start,
      end: mention.end,
      text: mention.text,
      entity
    }))
  );

  return all
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    .reduce<SpanMarker[]>((spans, span) => {
      const previous = spans[spans.length - 1];
      if (previous && span.start < previous.end) return spans;
      spans.push(span);
      return spans;
    }, []);
}
