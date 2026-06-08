import type { EntityPattern, Specialty } from "./types";

export const abbreviationDictionaries: Record<Specialty, Record<string, string>> = {
  mixed: {
    pt: "patient",
    "c/o": "complains of",
    "s/p": "status post",
    "f/u": "follow up",
    "w/": "with",
    "w/o": "without",
    hx: "history",
    dx: "diagnosis",
    tx: "treatment",
    rx: "prescription",
    x: "duration marker",
    bp: "blood pressure",
    hr: "heart rate",
    rr: "respiratory rate",
    spo2: "oxygen saturation",
    o2sat: "oxygen saturation",
    temp: "temperature",
    wt: "weight",
    pcn: "penicillin"
  },
  "primary-care": {
    htn: "hypertension",
    dm: "diabetes mellitus",
    t2dm: "type 2 diabetes mellitus",
    hld: "hyperlipidemia",
    cp: "chest pain",
    sob: "shortness of breath",
    uri: "upper respiratory infection",
    uti: "urinary tract infection",
    gerd: "gastroesophageal reflux disease",
    cad: "coronary artery disease",
    copd: "chronic obstructive pulmonary disease",
    ckd: "chronic kidney disease",
    chf: "congestive heart failure",
    osa: "obstructive sleep apnea",
    bmp: "basic metabolic panel",
    lft: "liver function test",
    lfts: "liver function tests",
    a1c: "hemoglobin A1c",
    cbc: "complete blood count"
  },
  "mental-health": {
    si: "suicidal ideation",
    hi: "homicidal ideation",
    avh: "auditory/visual hallucinations",
    mdd: "major depressive disorder",
    gad: "generalized anxiety disorder",
    ptsd: "post-traumatic stress disorder",
    cbt: "cognitive behavioral therapy",
    dbt: "dialectical behavior therapy",
    "phq-9": "Patient Health Questionnaire-9",
    "gad-7": "Generalized Anxiety Disorder-7",
    "audit-c": "Alcohol Use Disorders Identification Test-Consumption",
    "c-ssrs": "Columbia Suicide Severity Rating Scale"
  },
  "physical-therapy": {
    rom: "range of motion",
    arom: "active range of motion",
    prom: "passive range of motion",
    hep: "home exercise program",
    wb: "weight bearing",
    nwb: "non-weight bearing",
    rle: "right lower extremity",
    lle: "left lower extremity",
    rue: "right upper extremity",
    lue: "left upper extremity",
    er: "external rotation",
    ir: "internal rotation",
    abd: "abduction",
    add: "adduction",
    flex: "flexion",
    ext: "extension",
    mmt: "manual muscle testing",
    slr: "straight leg raise",
    tug: "Timed Up and Go",
    "5xsts": "five times sit to stand"
  }
};

export const entityPatterns: EntityPattern[] = [
  {
    canonicalName: "follow up",
    displayName: "Follow up",
    type: "plan",
    terms: ["f/u", "follow up", "follow-up"],
    specialties: ["mixed"]
  },
  {
    canonicalName: "hypertension",
    type: "problem",
    terms: ["HTN", "hypertension"],
    specialties: ["primary-care"]
  },
  {
    canonicalName: "type 2 diabetes mellitus",
    displayName: "Type 2 diabetes mellitus",
    type: "problem",
    terms: ["T2DM", "diabetes mellitus", "DM"],
    specialties: ["primary-care"]
  },
  {
    canonicalName: "hyperlipidemia",
    type: "problem",
    terms: ["HLD", "hyperlipidemia"],
    specialties: ["primary-care"]
  },
  {
    canonicalName: "asthma",
    type: "problem",
    terms: ["asthma", "reactive airway disease"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "chronic obstructive pulmonary disease",
    displayName: "COPD",
    type: "problem",
    terms: ["COPD", "chronic obstructive pulmonary disease"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "coronary artery disease",
    displayName: "CAD",
    type: "problem",
    terms: ["CAD", "coronary artery disease"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "congestive heart failure",
    displayName: "CHF",
    type: "problem",
    terms: ["CHF", "congestive heart failure", "heart failure"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "chronic kidney disease",
    displayName: "CKD",
    type: "problem",
    terms: ["CKD", "chronic kidney disease"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "obstructive sleep apnea",
    displayName: "OSA",
    type: "problem",
    terms: ["OSA", "obstructive sleep apnea", "sleep apnea"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "obesity",
    type: "problem",
    terms: ["obesity", "obese"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "chest pain",
    type: "symptom",
    terms: ["CP", "chest pain"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "shortness of breath",
    type: "symptom",
    terms: ["SOB", "shortness of breath"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "cough",
    type: "symptom",
    terms: ["cough", "coughing"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "fever",
    type: "symptom",
    terms: ["fever", "febrile"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "fatigue",
    type: "symptom",
    terms: ["fatigue", "tiredness"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "dizziness",
    type: "symptom",
    terms: ["dizziness", "dizzy", "lightheadedness"],
    specialties: ["primary-care", "physical-therapy", "mixed"]
  },
  {
    canonicalName: "nausea",
    type: "symptom",
    terms: ["nausea", "nauseated"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "diarrhea",
    type: "symptom",
    terms: ["diarrhea"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "headache",
    type: "symptom",
    terms: ["headache", "HA"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "hemoglobin A1c",
    displayName: "A1c",
    type: "lab",
    terms: ["A1c", "hemoglobin A1c"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "body mass index",
    displayName: "BMI",
    type: "vital",
    terms: ["BMI", "body mass index"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "comprehensive metabolic panel",
    displayName: "CMP",
    type: "lab",
    terms: ["CMP", "comprehensive metabolic panel"],
    specialties: ["primary-care"]
  },
  {
    canonicalName: "complete blood count",
    displayName: "CBC",
    type: "lab",
    terms: ["CBC", "complete blood count"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "basic metabolic panel",
    displayName: "BMP",
    type: "lab",
    terms: ["BMP", "basic metabolic panel"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "liver function tests",
    displayName: "LFTs",
    type: "lab",
    terms: ["LFTs", "LFT", "liver function tests", "hepatic function panel"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "lipid panel",
    type: "lab",
    terms: ["lipid panel"],
    specialties: ["primary-care"]
  },
  {
    canonicalName: "lisinopril",
    type: "medication",
    terms: ["lisinopril"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "atorvastatin",
    type: "medication",
    terms: ["atorvastatin", "Lipitor"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "amlodipine",
    type: "medication",
    terms: ["amlodipine", "Norvasc"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "losartan",
    type: "medication",
    terms: ["losartan", "Cozaar"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "levothyroxine",
    type: "medication",
    terms: ["levothyroxine", "Synthroid"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "omeprazole",
    type: "medication",
    terms: ["omeprazole", "Prilosec"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "major depressive disorder",
    displayName: "Major depressive disorder",
    type: "problem",
    terms: ["MDD", "major depressive disorder", "major depression", "clinical depression", "depressive disorder"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "depression",
    type: "symptom",
    terms: ["depression", "depressed"],
    specialties: ["primary-care", "mental-health", "mixed"],
    confidence: "medium"
  },
  {
    canonicalName: "generalized anxiety disorder",
    displayName: "Generalized anxiety disorder",
    type: "problem",
    terms: ["GAD", "generalized anxiety disorder", "generalized anxiety"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "anxiety",
    type: "symptom",
    terms: ["anxiety", "anxious"],
    specialties: ["primary-care", "mental-health", "mixed"],
    confidence: "medium"
  },
  {
    canonicalName: "post-traumatic stress disorder",
    displayName: "PTSD",
    type: "problem",
    terms: ["PTSD", "post-traumatic stress disorder", "post traumatic stress disorder"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "auditory/visual hallucinations",
    displayName: "AVH",
    type: "symptom",
    terms: ["AVH", "auditory hallucinations", "visual hallucinations", "hallucinations"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "low mood",
    type: "symptom",
    terms: ["low mood", "depressed mood"],
    specialties: ["mental-health"]
  },
  {
    canonicalName: "anhedonia",
    type: "symptom",
    terms: ["anhedonia"],
    specialties: ["mental-health"]
  },
  {
    canonicalName: "poor sleep",
    type: "symptom",
    terms: ["poor sleep", "insomnia"],
    specialties: ["mental-health"]
  },
  {
    canonicalName: "suicidal ideation",
    displayName: "Suicidal ideation",
    type: "risk",
    terms: ["SI", "suicidal ideation"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "homicidal ideation",
    displayName: "Homicidal ideation",
    type: "risk",
    terms: ["HI", "homicidal ideation"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "Patient Health Questionnaire-9",
    displayName: "PHQ-9",
    type: "score",
    terms: ["PHQ-9", "Patient Health Questionnaire-9"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "Generalized Anxiety Disorder-7",
    displayName: "GAD-7",
    type: "score",
    terms: ["GAD-7", "Generalized Anxiety Disorder-7"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "Alcohol Use Disorders Identification Test-Consumption",
    displayName: "AUDIT-C",
    type: "score",
    terms: ["AUDIT-C", "Alcohol Use Disorders Identification Test-Consumption"],
    specialties: ["primary-care", "mental-health", "mixed"]
  },
  {
    canonicalName: "Columbia Suicide Severity Rating Scale",
    displayName: "C-SSRS",
    type: "score",
    terms: ["C-SSRS", "Columbia Suicide Severity Rating Scale"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "sertraline",
    type: "medication",
    terms: ["sertraline", "Zoloft"],
    specialties: ["mental-health", "mixed"]
  },
  {
    canonicalName: "fluoxetine",
    type: "medication",
    terms: ["fluoxetine", "Prozac"],
    specialties: ["mental-health", "primary-care", "mixed"]
  },
  {
    canonicalName: "escitalopram",
    type: "medication",
    terms: ["escitalopram", "Lexapro"],
    specialties: ["mental-health", "primary-care", "mixed"]
  },
  {
    canonicalName: "bupropion",
    type: "medication",
    terms: ["bupropion", "Wellbutrin"],
    specialties: ["mental-health", "primary-care", "mixed"]
  },
  {
    canonicalName: "duloxetine",
    type: "medication",
    terms: ["duloxetine", "Cymbalta"],
    specialties: ["mental-health", "primary-care", "physical-therapy", "mixed"]
  },
  {
    canonicalName: "metformin",
    type: "medication",
    terms: ["metformin"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "ibuprofen",
    type: "medication",
    terms: ["ibuprofen", "Advil", "Motrin"],
    specialties: ["primary-care", "physical-therapy", "mixed"]
  },
  {
    canonicalName: "gabapentin",
    type: "medication",
    terms: ["gabapentin", "Neurontin"],
    specialties: ["primary-care", "physical-therapy", "mixed"]
  },
  {
    canonicalName: "acetaminophen",
    type: "medication",
    terms: ["acetaminophen", "Tylenol"],
    specialties: ["primary-care", "physical-therapy", "mixed"]
  },
  {
    canonicalName: "albuterol",
    type: "medication",
    terms: ["albuterol"],
    specialties: ["primary-care", "mixed"]
  },
  {
    canonicalName: "cognitive behavioral therapy",
    displayName: "CBT",
    type: "plan",
    terms: ["CBT", "cognitive behavioral therapy"],
    specialties: ["mental-health"]
  },
  {
    canonicalName: "dialectical behavior therapy",
    displayName: "DBT",
    type: "plan",
    terms: ["DBT", "dialectical behavior therapy"],
    specialties: ["mental-health"]
  },
  {
    canonicalName: "low back pain",
    displayName: "Low back pain",
    type: "problem",
    terms: ["LBP", "low back pain", "back pain"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "dysphagia",
    type: "problem",
    terms: ["dysphagia", "swallowing difficulty", "difficulty swallowing"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "aphasia",
    type: "problem",
    terms: ["aphasia"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "dysarthria",
    type: "problem",
    terms: ["dysarthria", "slurred speech"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "augmentative and alternative communication",
    displayName: "AAC",
    type: "functional-limitation",
    terms: ["AAC", "augmentative and alternative communication"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "speech therapy",
    displayName: "Speech therapy",
    type: "referral",
    terms: ["ST", "speech therapy"],
    specialties: ["physical-therapy", "mixed"],
    confidence: "medium"
  },
  {
    canonicalName: "speech-language pathology",
    displayName: "SLP",
    type: "referral",
    terms: ["SLP", "speech-language pathologist", "speech language pathologist"],
    specialties: ["physical-therapy", "mixed"],
    confidence: "medium"
  },
  {
    canonicalName: "modified barium swallow study",
    displayName: "MBSS",
    type: "imaging",
    terms: ["MBSS", "modified barium swallow study"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "videofluoroscopic swallowing study",
    displayName: "VFSS",
    type: "imaging",
    terms: ["VFSS", "videofluoroscopic swallowing study"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "aspiration risk",
    type: "risk",
    terms: ["aspiration risk", "risk for aspiration"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "diet texture modification",
    type: "plan",
    terms: ["diet texture modification", "mechanical soft diet", "pureed diet", "thickened liquids"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "neck pain",
    type: "problem",
    terms: ["neck pain", "cervical pain"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "knee pain",
    type: "problem",
    terms: ["knee pain", "R knee pain", "right knee pain", "L knee pain", "left knee pain"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "hip pain",
    type: "problem",
    terms: ["hip pain", "R hip pain", "right hip pain", "L hip pain", "left hip pain"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "shoulder pain",
    type: "problem",
    terms: ["shoulder pain", "R shoulder pain", "right shoulder pain", "L shoulder pain", "left shoulder pain"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "range of motion",
    displayName: "ROM",
    type: "finding",
    terms: ["ROM", "range of motion"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "active range of motion",
    displayName: "AROM",
    type: "finding",
    terms: ["AROM", "active range of motion"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "flexion",
    type: "finding",
    terms: ["flex", "flexion"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "abduction",
    type: "finding",
    terms: ["abd", "abduction"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "external rotation",
    displayName: "ER",
    type: "finding",
    terms: ["ER", "external rotation"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "Hawkins test",
    displayName: "Hawkins",
    type: "special-test",
    terms: ["Hawkins", "Hawkins test"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "Neer test",
    displayName: "Neer",
    type: "special-test",
    terms: ["Neer", "Neer test"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "straight leg raise",
    displayName: "SLR",
    type: "special-test",
    terms: ["SLR", "straight leg raise"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "FABER test",
    displayName: "FABER",
    type: "special-test",
    terms: ["FABER", "FABER test"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "McMurray test",
    displayName: "McMurray",
    type: "special-test",
    terms: ["McMurray", "McMurray test"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "Lachman test",
    displayName: "Lachman",
    type: "special-test",
    terms: ["Lachman", "Lachman test"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "Timed Up and Go",
    displayName: "TUG",
    type: "functional-limitation",
    terms: ["TUG", "Timed Up and Go"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "five times sit to stand",
    displayName: "5xSTS",
    type: "functional-limitation",
    terms: ["5xSTS", "five times sit to stand"],
    specialties: ["physical-therapy", "mixed"]
  },
  {
    canonicalName: "home exercise program",
    displayName: "HEP",
    type: "exercise",
    terms: ["HEP", "home exercise program"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "overhead reach",
    type: "functional-limitation",
    terms: ["overhead reach", "reaching overhead"],
    specialties: ["physical-therapy"]
  },
  {
    canonicalName: "numbness",
    type: "symptom",
    terms: ["numbness"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "tingling",
    type: "symptom",
    terms: ["tingling"],
    specialties: ["physical-therapy", "primary-care", "mixed"]
  },
  {
    canonicalName: "leg radiation",
    type: "symptom",
    terms: ["radiates to R leg", "radiates to right leg", "R leg", "right leg"],
    specialties: ["physical-therapy", "mixed"],
    confidence: "medium"
  }
];
