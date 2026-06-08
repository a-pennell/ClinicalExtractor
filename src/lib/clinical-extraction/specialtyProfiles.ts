import type { Specialty } from "./types";

export const specialtyLabels: Record<Specialty, string> = {
  "primary-care": "Primary Care",
  "mental-health": "Mental Health",
  "physical-therapy": "Physical Therapy",
  mixed: "Mixed / Auto"
};

export function specialtyMatches(selected: Specialty, entitySpecialties: Specialty[]) {
  return selected === "mixed" || entitySpecialties.includes(selected) || entitySpecialties.includes("mixed");
}

export function specialtyMatchesAny(activeSpecialties: Specialty[], entitySpecialties: Specialty[]) {
  return entitySpecialties.includes("mixed") || activeSpecialties.some((specialty) => entitySpecialties.includes(specialty));
}
