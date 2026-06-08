import { extractClinicalEntities } from "./extractClinicalEntities";
import { detectClinicalContext } from "./clinicalContext";
import type { AssertionStatus, ClinicalEntityType, Specialty, TerminologySystem } from "./types";

export type EvaluationFixture = {
  id: string;
  specialty: Specialty;
  text: string;
  expectedCanonicalNames: string[];
  expectedAmbiguityResolutions?: {
    abbreviation: string;
    chosenMeaning: string;
  }[];
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

export type CoverageMetricRow<T extends string> = {
  key: T;
  expectedCount?: number;
  matchedCount?: number;
  missedCount?: number;
  extraCount?: number;
  foundCount?: number;
  codedEntityCount?: number;
  candidateCount?: number;
  selectedCount?: number;
  recall?: number;
};

export type EvaluationCoverageDashboard = {
  totalNotes: number;
  totalExpected: number;
  totalMatched: number;
  totalMissed: number;
  totalExtra: number;
  recall: number;
  bySpecialty: CoverageMetricRow<Specialty>[];
  byEntityType: CoverageMetricRow<ClinicalEntityType>[];
  byAssertion: CoverageMetricRow<AssertionStatus>[];
  byTerminologySystem: CoverageMetricRow<TerminologySystem>[];
  noteHotspots: EvaluationCaseResult[];
};

export type CoverageBacklogItem = {
  fixtureId: string;
  specialty: Specialty;
  canonicalName: string;
};

export const ambiguityEvaluationFixtures: EvaluationFixture[] = [
  {
    id: "ambiguity-pt-referral",
    specialty: "mixed",
    text: "Referral to PT for ROM and HEP after discharge.",
    expectedCanonicalNames: ["referral to physical therapy", "range of motion", "home exercise program"],
    expectedAmbiguityResolutions: [
      { abbreviation: "PT", chosenMeaning: "physical therapy" },
      { abbreviation: "ROM", chosenMeaning: "range of motion" }
    ]
  },
  {
    id: "ambiguity-si-risk",
    specialty: "mixed",
    text: "Low mood. Denies SI/HI. PHQ-9 18.",
    expectedCanonicalNames: ["low mood", "suicidal ideation", "homicidal ideation", "Patient Health Questionnaire-9"],
    expectedAmbiguityResolutions: [{ abbreviation: "SI", chosenMeaning: "suicidal ideation" }]
  },
  {
    id: "ambiguity-slp-swallow",
    specialty: "mixed",
    text: "SLP eval for dysphagia. MBSS ordered. Aspiration risk noted. Thickened liquids recommended.",
    expectedCanonicalNames: [
      "speech-language pathology",
      "dysphagia",
      "modified barium swallow study",
      "aspiration risk",
      "diet texture modification"
    ],
    expectedAmbiguityResolutions: []
  }
];

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

export function evaluateAmbiguityFixtures(fixtures: EvaluationFixture[] = ambiguityEvaluationFixtures) {
  return fixtures.map((fixture) => {
    const context = detectClinicalContext(fixture.text);
    const expected = fixture.expectedAmbiguityResolutions ?? [];
    const matched = expected.filter((resolution) =>
      context.ambiguityWarnings.some(
        (warning) =>
          warning.abbreviation === resolution.abbreviation && warning.chosenMeaning === resolution.chosenMeaning
      )
    );

    return {
      id: fixture.id,
      expectedCount: expected.length,
      matchedCount: matched.length,
      missedResolutions: expected.filter(
        (resolution) =>
          !matched.some(
            (matchedResolution) =>
              matchedResolution.abbreviation === resolution.abbreviation &&
              matchedResolution.chosenMeaning === resolution.chosenMeaning
          )
      )
    };
  });
}

export function buildEvaluationCoverageDashboard(fixtures: EvaluationFixture[] = evaluationFixtures): EvaluationCoverageDashboard {
  const result = evaluateExtractionFixtures(fixtures);
  const extractionRows = fixtures.map((fixture) => ({
    fixture,
    entities: extractClinicalEntities(fixture.text, { specialty: fixture.specialty })
  }));
  const totalMissed = result.caseResults.reduce((sum, caseResult) => sum + caseResult.missedCanonicalNames.length, 0);
  const totalExtra = result.caseResults.reduce((sum, caseResult) => sum + caseResult.extraCanonicalNames.length, 0);

  return {
    totalNotes: fixtures.length,
    totalExpected: result.totalExpected,
    totalMatched: result.totalMatched,
    totalMissed,
    totalExtra,
    recall: result.recall,
    bySpecialty: buildSpecialtyRows(result),
    byEntityType: buildEntityTypeRows(extractionRows),
    byAssertion: buildAssertionRows(extractionRows),
    byTerminologySystem: buildTerminologyRows(extractionRows),
    noteHotspots: result.caseResults
      .filter((caseResult) => caseResult.missedCanonicalNames.length || caseResult.extraCanonicalNames.length)
      .sort((a, b) => {
        const bGap = b.missedCanonicalNames.length + b.extraCanonicalNames.length;
        const aGap = a.missedCanonicalNames.length + a.extraCanonicalNames.length;
        return bGap - aGap || a.id.localeCompare(b.id);
      })
  };
}

function buildSpecialtyRows(result: EvaluationResult): CoverageMetricRow<Specialty>[] {
  const rows = emptySpecialtyRows();

  result.caseResults.forEach((caseResult) => {
    const row = rows[caseResult.specialty];
    row.expectedCount = (row.expectedCount ?? 0) + caseResult.expectedCount;
    row.matchedCount = (row.matchedCount ?? 0) + caseResult.matchedCount;
    row.missedCount = (row.missedCount ?? 0) + caseResult.missedCanonicalNames.length;
    row.extraCount = (row.extraCount ?? 0) + caseResult.extraCanonicalNames.length;
  });

  return Object.values(rows).map((row) => ({
    ...row,
    recall: row.expectedCount ? (row.matchedCount ?? 0) / row.expectedCount : 1
  }));
}

function buildEntityTypeRows(
  extractionRows: { entities: ReturnType<typeof extractClinicalEntities> }[]
): CoverageMetricRow<ClinicalEntityType>[] {
  const rows = new Map<ClinicalEntityType, CoverageMetricRow<ClinicalEntityType>>();

  extractionRows.forEach(({ entities }) => {
    entities.forEach((entity) => {
      const row = getMetricRow(rows, entity.type);
      row.foundCount = (row.foundCount ?? 0) + 1;
      if (entity.codings?.length) row.codedEntityCount = (row.codedEntityCount ?? 0) + 1;
    });
  });

  return sortRows(Array.from(rows.values()));
}

function buildAssertionRows(
  extractionRows: { entities: ReturnType<typeof extractClinicalEntities> }[]
): CoverageMetricRow<AssertionStatus>[] {
  const rows = new Map<AssertionStatus, CoverageMetricRow<AssertionStatus>>();

  extractionRows.forEach(({ entities }) => {
    entities.forEach((entity) => {
      const assertion = entity.attributes?.assertion ?? "present";
      const row = getMetricRow(rows, assertion);
      row.foundCount = (row.foundCount ?? 0) + 1;
    });
  });

  return sortRows(Array.from(rows.values()));
}

function buildTerminologyRows(
  extractionRows: { entities: ReturnType<typeof extractClinicalEntities> }[]
): CoverageMetricRow<TerminologySystem>[] {
  const rows = new Map<TerminologySystem, CoverageMetricRow<TerminologySystem>>();

  extractionRows.forEach(({ entities }) => {
    entities.forEach((entity) => {
      const systemsForEntity = new Set<TerminologySystem>();
      entity.codings?.forEach((coding) => {
        const row = getMetricRow(rows, coding.system);
        row.candidateCount = (row.candidateCount ?? 0) + 1;
        if (coding.status === "selected") row.selectedCount = (row.selectedCount ?? 0) + 1;
        systemsForEntity.add(coding.system);
      });
      systemsForEntity.forEach((system) => {
        const row = getMetricRow(rows, system);
        row.codedEntityCount = (row.codedEntityCount ?? 0) + 1;
      });
    });
  });

  return sortRows(Array.from(rows.values()));
}

function emptySpecialtyRows() {
  return {
    "primary-care": { key: "primary-care", expectedCount: 0, matchedCount: 0, missedCount: 0, extraCount: 0 },
    "mental-health": { key: "mental-health", expectedCount: 0, matchedCount: 0, missedCount: 0, extraCount: 0 },
    "physical-therapy": {
      key: "physical-therapy",
      expectedCount: 0,
      matchedCount: 0,
      missedCount: 0,
      extraCount: 0
    },
    mixed: { key: "mixed", expectedCount: 0, matchedCount: 0, missedCount: 0, extraCount: 0 }
  } satisfies Record<Specialty, CoverageMetricRow<Specialty>>;
}

function getMetricRow<T extends string>(rows: Map<T, CoverageMetricRow<T>>, key: T) {
  const existing = rows.get(key);
  if (existing) return existing;

  const row: CoverageMetricRow<T> = { key };
  rows.set(key, row);
  return row;
}

function sortRows<T extends string>(rows: CoverageMetricRow<T>[]) {
  return rows.sort((a, b) => {
    const bCount = b.foundCount ?? b.candidateCount ?? b.expectedCount ?? 0;
    const aCount = a.foundCount ?? a.candidateCount ?? a.expectedCount ?? 0;
    return bCount - aCount || a.key.localeCompare(b.key);
  });
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
