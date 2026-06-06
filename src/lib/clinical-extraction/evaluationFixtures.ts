import { extractClinicalEntities } from "./extractClinicalEntities";
import type { Specialty } from "./types";

export type EvaluationFixture = {
  id: string;
  specialty: Specialty;
  text: string;
  expectedCanonicalNames: string[];
};

export type EvaluationCaseResult = {
  id: string;
  specialty: Specialty;
  expectedCount: number;
  matchedCount: number;
  recall: number;
  expectedCanonicalNames: string[];
  foundCanonicalNames: string[];
  missedCanonicalNames: string[];
  extraCanonicalNames: string[];
};

export type EvaluationResult = {
  caseResults: EvaluationCaseResult[];
  totalExpected: number;
  totalMatched: number;
  recall: number;
};

export type CoverageBacklogItem = {
  fixtureId: string;
  specialty: Specialty;
  canonicalName: string;
};

export const evaluationFixtures: EvaluationFixture[] = [
  {
    id: "primary-care-chronic-metabolic",
    specialty: "primary-care",
    text: "Assessment: HTN, T2DM, HLD. Meds: lisinopril 20mg daily, metformin 500mg BID, atorvastatin 40mg. Labs: A1c 8.1 LDL 140.",
    expectedCanonicalNames: [
      "hypertension",
      "type 2 diabetes mellitus",
      "hyperlipidemia",
      "lisinopril",
      "metformin",
      "atorvastatin",
      "hemoglobin A1c",
      "low density lipoprotein cholesterol"
    ]
  },
  {
    id: "primary-care-respiratory",
    specialty: "primary-care",
    text: "HPI: COPD with cough and SOB. BP 142/90, HR 102, SpO2 93%. Albuterol inhaler 2 puffs q4h PRN wheeze. Ordered CXR.",
    expectedCanonicalNames: [
      "chronic obstructive pulmonary disease",
      "cough",
      "shortness of breath",
      "blood pressure",
      "heart rate",
      "oxygen saturation",
      "albuterol",
      "chest x-ray"
    ]
  },
  {
    id: "primary-care-preventive-labs",
    specialty: "primary-care",
    text: "Objective: BMI 32, wt 188 lb. Labs: CBC ordered, Hgb 12.9, TSH 4.2, Cr 1.0, eGFR 80. Plan: F/u in 3 mo.",
    expectedCanonicalNames: [
      "body mass index",
      "body weight",
      "complete blood count",
      "hemoglobin",
      "thyroid stimulating hormone",
      "creatinine",
      "estimated glomerular filtration rate",
      "follow up"
    ]
  },
  {
    id: "primary-care-social-family",
    specialty: "primary-care",
    text: "Social Hx: Denies tobacco. EtOH social. Family Hx: father with colon cancer. Allergy: penicillin - rash. NKDA reviewed in old chart.",
    expectedCanonicalNames: [
      "tobacco use",
      "alcohol use",
      "family history of colon cancer",
      "penicillin allergy",
      "no known drug allergies"
    ]
  },
  {
    id: "primary-care-cardiac-renal",
    specialty: "primary-care",
    text: "PMH: CAD, CHF, CKD, OSA, obesity. Meds: amlodipine 5mg daily, losartan 50mg daily, levothyroxine 75mcg daily.",
    expectedCanonicalNames: [
      "coronary artery disease",
      "congestive heart failure",
      "chronic kidney disease",
      "obstructive sleep apnea",
      "obesity",
      "amlodipine",
      "losartan",
      "levothyroxine"
    ]
  },
  {
    id: "mental-health-risk-plan",
    specialty: "mental-health",
    text: "HPI: Major depression with anxiety. Denies SI/HI. PHQ-9 19 GAD-7 13. Plan: fluoxetine 20mg daily, CBT weekly, safety plan reviewed.",
    expectedCanonicalNames: [
      "major depressive disorder",
      "anxiety",
      "suicidal ideation",
      "homicidal ideation",
      "Patient Health Questionnaire-9",
      "Generalized Anxiety Disorder-7",
      "fluoxetine",
      "cognitive behavioral therapy",
      "safety plan"
    ]
  },
  {
    id: "mental-health-trauma-hallucinations",
    specialty: "mental-health",
    text: "PMH: PTSD and GAD. Denies AVH. Poor sleep and low mood. Continue sertraline 100mg PO qAM.",
    expectedCanonicalNames: [
      "post-traumatic stress disorder",
      "generalized anxiety disorder",
      "auditory/visual hallucinations",
      "poor sleep",
      "low mood",
      "sertraline"
    ]
  },
  {
    id: "mental-health-panic-substance",
    specialty: "mental-health",
    text: "HPI: Panic attacks weekly with anxiety. AUDIT-C 5. Uses cannabis occasionally. Denies alcohol. Plan: DBT weekly.",
    expectedCanonicalNames: [
      "panic attacks",
      "anxiety",
      "Alcohol Use Disorders Identification Test-Consumption",
      "substance use",
      "alcohol use",
      "dialectical behavior therapy"
    ]
  },
  {
    id: "mental-health-mood-meds",
    specialty: "mental-health",
    text: "Assessment: Major depression and anhedonia. C-SSRS 1. Start escitalopram 10mg daily. Safety plan reviewed.",
    expectedCanonicalNames: [
      "major depressive disorder",
      "anhedonia",
      "Columbia Suicide Severity Rating Scale",
      "escitalopram",
      "safety plan"
    ]
  },
  {
    id: "mental-health-bipolar-screen",
    specialty: "mental-health",
    text: "HPI: Hypomania symptoms last week, denies SI/HI today. PHQ-9 8, GAD-7 4. Continue bupropion 150mg daily.",
    expectedCanonicalNames: [
      "mania",
      "suicidal ideation",
      "homicidal ideation",
      "Patient Health Questionnaire-9",
      "Generalized Anxiety Disorder-7",
      "bupropion"
    ]
  },
  {
    id: "physical-therapy-low-back",
    specialty: "physical-therapy",
    text: "Subjective: LBP radiates to R leg. Denies numbness or tingling. Objective: SLR positive. TUG 14 sec. Plan: HEP reviewed.",
    expectedCanonicalNames: [
      "low back pain",
      "leg radiation",
      "numbness",
      "tingling",
      "straight leg raise",
      "Timed Up and Go",
      "home exercise program"
    ]
  },
  {
    id: "physical-therapy-shoulder",
    specialty: "physical-therapy",
    text: "R shoulder pain with overhead reach. AROM flex 110, abd 90. ER 4-/5. Hawkins and Neer positive. HEP reviewed.",
    expectedCanonicalNames: [
      "shoulder pain",
      "overhead reach",
      "range of motion measurement",
      "manual muscle test",
      "Hawkins test",
      "Neer test",
      "home exercise program"
    ]
  },
  {
    id: "physical-therapy-knee",
    specialty: "physical-therapy",
    text: "L knee pain after stairs. McMurray test positive. Lachman negative. Pain 5/10. 5xSTS 18 sec. Cont 2x/wk x 4 wks.",
    expectedCanonicalNames: [
      "knee pain",
      "McMurray test",
      "Lachman test",
      "pain rating",
      "five times sit to stand",
      "treatment frequency",
      "duration"
    ]
  },
  {
    id: "physical-therapy-balance-gait",
    specialty: "physical-therapy",
    text: "Objective: Antalgic gait and impaired balance. Fall risk noted. TUG 16 sec. WBAT with cane. HEP progressed.",
    expectedCanonicalNames: ["gait abnormality", "impaired balance", "fall risk", "Timed Up and Go", "home exercise program"]
  },
  {
    id: "physical-therapy-neck-hip",
    specialty: "physical-therapy",
    text: "Neck pain and R hip pain. ROM limited in flexion. FABER test positive. Gabapentin listed. Pain 6/10.",
    expectedCanonicalNames: ["neck pain", "hip pain", "range of motion", "flexion", "FABER test", "gabapentin", "pain rating"]
  },
  {
    id: "mixed-back-mood-imaging",
    specialty: "mixed",
    text: "Pt reports worsening LBP x 3 weeks after lifting boxes. Pain 6/10 radiates to R leg. PHQ-9 14. Ordered MRI lumbar spine. Referral to PT.",
    expectedCanonicalNames: [
      "low back pain",
      "duration",
      "pain rating",
      "leg radiation",
      "Patient Health Questionnaire-9",
      "lumbar spine MRI",
      "referral to physical therapy"
    ]
  },
  {
    id: "mixed-diabetes-depression",
    specialty: "mixed",
    text: "Assessment: T2DM with A1c 7.9 and major depression. Started metformin 500mg BID and sertraline 50mg daily. Denies SI.",
    expectedCanonicalNames: [
      "type 2 diabetes mellitus",
      "hemoglobin A1c",
      "major depressive disorder",
      "metformin",
      "sertraline",
      "suicidal ideation"
    ]
  },
  {
    id: "mixed-respiratory-anxiety",
    specialty: "mixed",
    text: "COPD with SOB and anxiety. BP 138/84 HR 96. SpO2 95%. Albuterol inhaler 2 puffs q4h PRN wheeze. GAD-7 11.",
    expectedCanonicalNames: [
      "chronic obstructive pulmonary disease",
      "shortness of breath",
      "anxiety",
      "blood pressure",
      "heart rate",
      "oxygen saturation",
      "albuterol",
      "Generalized Anxiety Disorder-7"
    ]
  },
  {
    id: "mixed-social-risk-plan",
    specialty: "mixed",
    text: "Social Hx: Tobacco current 1 ppd, EtOH social, marijuana occasionally. Family Hx: mother with diabetes. Plan: CBT weekly and safety plan.",
    expectedCanonicalNames: [
      "tobacco use",
      "alcohol use",
      "substance use",
      "family history of diabetes mellitus",
      "cognitive behavioral therapy",
      "safety plan"
    ]
  },
  {
    id: "mixed-shoulder-primary-care",
    specialty: "mixed",
    text: "R shoulder pain with overhead reach. AROM flex 120. HLD on atorvastatin 20mg daily. BMI 31. Allergy: latex - rash.",
    expectedCanonicalNames: [
      "shoulder pain",
      "overhead reach",
      "range of motion measurement",
      "hyperlipidemia",
      "atorvastatin",
      "body mass index",
      "latex allergy"
    ]
  }
];

export function evaluateExtractionFixtures(fixtures: EvaluationFixture[] = evaluationFixtures): EvaluationResult {
  const caseResults = fixtures.map(evaluateFixture);

  const totalExpected = caseResults.reduce((sum, result) => sum + result.expectedCount, 0);
  const totalMatched = caseResults.reduce((sum, result) => sum + result.matchedCount, 0);

  return {
    caseResults,
    totalExpected,
    totalMatched,
    recall: totalExpected ? totalMatched / totalExpected : 1
  };
}

export function evaluateFixture(fixture: EvaluationFixture): EvaluationCaseResult {
  const foundCanonicalNames = uniqueSorted(
    extractClinicalEntities(fixture.text, { specialty: fixture.specialty }).map((entity) => entity.canonicalName)
  );
  const expectedCanonicalNames = uniqueSorted(fixture.expectedCanonicalNames);
  const foundSet = new Set(foundCanonicalNames);
  const expectedSet = new Set(expectedCanonicalNames);
  const missedCanonicalNames = expectedCanonicalNames.filter((canonicalName) => !foundSet.has(canonicalName));
  const extraCanonicalNames = foundCanonicalNames.filter((canonicalName) => !expectedSet.has(canonicalName));
  const matchedCount = expectedCanonicalNames.length - missedCanonicalNames.length;

  return {
    id: fixture.id,
    specialty: fixture.specialty,
    expectedCount: expectedCanonicalNames.length,
    matchedCount,
    recall: expectedCanonicalNames.length ? matchedCount / expectedCanonicalNames.length : 1,
    expectedCanonicalNames,
    foundCanonicalNames,
    missedCanonicalNames,
    extraCanonicalNames
  };
}

export function buildCoverageBacklog(result: EvaluationResult): CoverageBacklogItem[] {
  return result.caseResults.flatMap((caseResult) =>
    caseResult.missedCanonicalNames.map((canonicalName) => ({
      fixtureId: caseResult.id,
      specialty: caseResult.specialty,
      canonicalName
    }))
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
