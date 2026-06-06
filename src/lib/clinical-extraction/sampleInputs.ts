import type { Specialty } from "./types";

export const sampleInputs: Record<Specialty, string> = {
  "primary-care": "HTN controlled on lisinopril 20mg daily. A1c 7.8. Denies CP/SOB. BMI 31. Allergy: penicillin - rash. Ordered CMP and lipid panel. F/u in 3 mo.",
  "mental-health": "Pt endorses low mood, anhedonia, poor sleep. Denies SI/HI. PHQ-9 18, GAD-7 12. Continue sertraline 100mg. CBT weekly.",
  "physical-therapy": "R shoulder pain with overhead reach. AROM flex 110, abd 90. ER 4-/5. + Hawkins. HEP reviewed. Cont 2x/wk x 4 wks.",
  mixed: "Pt reports worsening LBP x 3 weeks after lifting boxes. Pain 6/10, radiates to R leg. Denies numbness. ROM limited in lumbar flexion. PHQ-9 = 14. Started sertraline 50mg last month."
};
