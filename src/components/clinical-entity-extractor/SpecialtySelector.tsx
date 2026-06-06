import type { Specialty } from "../../lib/clinical-extraction/types";
import { specialtyLabels } from "../../lib/clinical-extraction/specialtyProfiles";

type SpecialtySelectorProps = {
  value: Specialty;
  onChange: (value: Specialty) => void;
};

const specialties: Specialty[] = ["primary-care", "mental-health", "physical-therapy", "mixed"];

export function SpecialtySelector({ value, onChange }: SpecialtySelectorProps) {
  return (
    <fieldset className="segmented-control">
      <legend>Specialty context</legend>
      {specialties.map((specialty) => (
        <button
          className={value === specialty ? "is-active" : ""}
          key={specialty}
          type="button"
          onClick={() => onChange(specialty)}
          aria-pressed={value === specialty}
        >
          {specialtyLabels[specialty]}
        </button>
      ))}
    </fieldset>
  );
}
