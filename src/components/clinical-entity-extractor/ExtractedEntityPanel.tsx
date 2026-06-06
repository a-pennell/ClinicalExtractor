import type { ClinicalEntity, ClinicalEntityType } from "../../lib/clinical-extraction/types";
import { EntityCard } from "./EntityCard";

type ExtractedEntityPanelProps = {
  entities: ClinicalEntity[];
  hasExtracted: boolean;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
};

const typeOrder: ClinicalEntityType[] = [
  "problem",
  "symptom",
  "risk",
  "medication",
  "lab",
  "vital",
  "score",
  "finding",
  "severity",
  "duration",
  "functional-limitation",
  "exercise",
  "plan",
  "special-test",
  "imaging",
  "procedure",
  "referral",
  "allergy",
  "body-site",
  "laterality",
  "other"
];

export function ExtractedEntityPanel({
  entities,
  hasExtracted,
  selectedEntityId,
  onSelectEntity
}: ExtractedEntityPanelProps) {
  const grouped = typeOrder
    .map((type) => ({ type, entities: entities.filter((entity) => entity.type === type) }))
    .filter((group) => group.entities.length > 0);

  if (!hasExtracted || entities.length === 0) {
    return (
      <div className="empty-state">
        <strong>{hasExtracted ? "No entities found" : "Ready to extract"}</strong>
        <span>Enter clinical text and run the local extractor.</span>
      </div>
    );
  }

  return (
    <div className="entity-groups">
      {grouped.map((group) => (
        <section className="entity-group" key={group.type}>
          <h3>
            <span>{formatType(group.type)}</span>
            <small>{group.entities.length}</small>
          </h3>
          <div className="entity-list">
            {group.entities.map((entity) => (
              <EntityCard
                entity={entity}
                isSelected={entity.id === selectedEntityId}
                key={entity.id}
                onSelect={() => onSelectEntity(entity.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatType(type: string) {
  return type.replace(/-/g, " ");
}
