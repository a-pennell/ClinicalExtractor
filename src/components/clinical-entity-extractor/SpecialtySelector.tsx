import type { Specialty } from "../../lib/clinical-extraction/types";
import { specialtyLabels } from "../../lib/clinical-extraction/specialtyProfiles";

type SpecialtySelectorProps = {
  mode: "auto" | "override";
  value: Specialty;
  onModeChange: (value: "auto" | "override") => void;
  onChange: (value: Specialty) => void;
};

const specialties: Specialty[] = ["primary-care", "mental-health", "physical-therapy", "mixed"];

export function SpecialtySelector({ mode, value, onModeChange, onChange }: SpecialtySelectorProps) {
  return (
    <fieldset className="segmented-control">
      <legend>Clinical context</legend>
      <button
        className={mode === "auto" ? "is-active" : ""}
        type="button"
        onClick={() => onModeChange("auto")}
        aria-pressed={mode === "auto"}
      >
        Auto detect
      </button>
      {specialties.map((specialty) => (
        <button
          className={mode === "override" && value === specialty ? "is-active" : ""}
          key={specialty}
          type="button"
          onClick={() => {
            onModeChange("override");
            onChange(specialty);
          }}
          aria-pressed={mode === "override" && value === specialty}
        >
          {specialtyLabels[specialty]}
        </button>
      ))}
    </fieldset>
  );
}
