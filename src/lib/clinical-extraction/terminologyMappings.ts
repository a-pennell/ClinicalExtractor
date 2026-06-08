import type { CandidateCoding, ClinicalEntity, ClinicalEntityType } from "./types";

export type TerminologyLookupInput = {
  canonicalName: string;
  type: ClinicalEntityType;
  attributes?: ClinicalEntity["attributes"];
};

export type TerminologyLookup = {
  lookupCandidates: (input: TerminologyLookupInput) => CandidateCoding[];
};

export const TERMINOLOGY_CONTENT_VERSION = "prototype-2026-06";

export const TERMINOLOGY_SYSTEM_VERSIONS = {
  "ICD-10-CM": "FY2026",
  "SNOMED-CT": "local prototype map; release not pinned",
  LOINC: "local prototype map; release not pinned",
  RxNorm: "local prototype map; release not pinned",
  CPT: "local prototype map; release not pinned",
  HCPCS: "local prototype map; release not pinned"
} as const;

const FY_2026_ICD_10_CM = TERMINOLOGY_SYSTEM_VERSIONS["ICD-10-CM"];

const terminologyByCanonicalName: Record<string, CandidateCoding[]> = {
  hypertension: [
    {
      system: "ICD-10-CM",
      code: "I10",
      display: "Essential (primary) hypertension",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate",
      rationale: "Starter mapping for unspecified hypertension; final coding depends on documentation and coding context."
    },
    {
      system: "SNOMED-CT",
      code: "38341003",
      display: "Hypertensive disorder, systemic arterial",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "type 2 diabetes mellitus": [
    {
      system: "ICD-10-CM",
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Unspecified candidate only; complications, insulin use, and other details can change coding."
    },
    {
      system: "SNOMED-CT",
      code: "44054006",
      display: "Type 2 diabetes mellitus",
      confidence: "medium",
      status: "candidate"
    }
  ],
  hyperlipidemia: [
    {
      system: "ICD-10-CM",
      code: "E78.5",
      display: "Hyperlipidemia, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "55822004",
      display: "Hyperlipidemia",
      confidence: "medium",
      status: "candidate"
    }
  ],
  asthma: [
    {
      system: "ICD-10-CM",
      code: "J45.909",
      display: "Unspecified asthma, uncomplicated",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Severity, persistence, and exacerbation status are not established by a simple asthma mention."
    },
    {
      system: "SNOMED-CT",
      code: "195967001",
      display: "Asthma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "chronic obstructive pulmonary disease": [
    {
      system: "ICD-10-CM",
      code: "J44.9",
      display: "Chronic obstructive pulmonary disease, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "13645005",
      display: "Chronic obstructive lung disease",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "coronary artery disease": [
    {
      system: "ICD-10-CM",
      code: "I25.10",
      display: "Atherosclerotic heart disease of native coronary artery without angina pectoris",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Final coding depends on native vessel, graft status, and angina documentation."
    },
    {
      system: "SNOMED-CT",
      code: "53741008",
      display: "Coronary arteriosclerosis",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "congestive heart failure": [
    {
      system: "ICD-10-CM",
      code: "I50.9",
      display: "Heart failure, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Type, acuity, and systolic/diastolic status require review."
    },
    {
      system: "SNOMED-CT",
      code: "42343007",
      display: "Congestive heart failure",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "chronic kidney disease": [
    {
      system: "ICD-10-CM",
      code: "N18.9",
      display: "Chronic kidney disease, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "CKD stage is not specified."
    },
    {
      system: "SNOMED-CT",
      code: "709044004",
      display: "Chronic kidney disease",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "obstructive sleep apnea": [
    {
      system: "ICD-10-CM",
      code: "G47.33",
      display: "Obstructive sleep apnea (adult) (pediatric)",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "78275009",
      display: "Obstructive sleep apnea syndrome",
      confidence: "medium",
      status: "candidate"
    }
  ],
  obesity: [
    {
      system: "ICD-10-CM",
      code: "E66.9",
      display: "Obesity, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "BMI class, severity, and comorbidity context require review."
    },
    {
      system: "SNOMED-CT",
      code: "414916001",
      display: "Obesity",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "chest pain": [
    {
      system: "ICD-10-CM",
      code: "R07.9",
      display: "Chest pain, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Symptom code candidate; not appropriate if a definitive diagnosis explains the symptom."
    },
    {
      system: "SNOMED-CT",
      code: "29857009",
      display: "Chest pain",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "shortness of breath": [
    {
      system: "ICD-10-CM",
      code: "R06.02",
      display: "Shortness of breath",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "267036007",
      display: "Dyspnea",
      confidence: "medium",
      status: "candidate"
    }
  ],
  cough: [
    {
      system: "ICD-10-CM",
      code: "R05.9",
      display: "Cough, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  fever: [
    {
      system: "ICD-10-CM",
      code: "R50.9",
      display: "Fever, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  fatigue: [
    {
      system: "ICD-10-CM",
      code: "R53.83",
      display: "Other fatigue",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  dizziness: [
    {
      system: "ICD-10-CM",
      code: "R42",
      display: "Dizziness and giddiness",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  nausea: [
    {
      system: "ICD-10-CM",
      code: "R11.0",
      display: "Nausea",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  diarrhea: [
    {
      system: "ICD-10-CM",
      code: "R19.7",
      display: "Diarrhea, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  headache: [
    {
      system: "ICD-10-CM",
      code: "R51.9",
      display: "Headache, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  "hemoglobin A1c": [
    {
      system: "LOINC",
      code: "4548-4",
      display: "Hemoglobin A1c/Hemoglobin.total in Blood",
      confidence: "high",
      status: "candidate"
    }
  ],
  "body mass index": [
    {
      system: "LOINC",
      code: "39156-5",
      display: "Body mass index (BMI) [Ratio]",
      confidence: "high",
      status: "candidate"
    }
  ],
  "blood pressure": [
    {
      system: "LOINC",
      code: "85354-9",
      display: "Blood pressure panel with all children optional",
      confidence: "high",
      status: "candidate"
    }
  ],
  "heart rate": [
    {
      system: "LOINC",
      code: "8867-4",
      display: "Heart rate",
      confidence: "high",
      status: "candidate"
    }
  ],
  "respiratory rate": [
    {
      system: "LOINC",
      code: "9279-1",
      display: "Respiratory rate",
      confidence: "high",
      status: "candidate"
    }
  ],
  "oxygen saturation": [
    {
      system: "LOINC",
      code: "59408-5",
      display: "Oxygen saturation in Arterial blood by Pulse oximetry",
      confidence: "medium",
      status: "candidate",
      rationale: "Assumes pulse oximetry when shorthand SpO2 or pulse ox is used."
    }
  ],
  "body temperature": [
    {
      system: "LOINC",
      code: "8310-5",
      display: "Body temperature",
      confidence: "high",
      status: "candidate"
    }
  ],
  "body weight": [
    {
      system: "LOINC",
      code: "29463-7",
      display: "Body weight",
      confidence: "high",
      status: "candidate"
    }
  ],
  "comprehensive metabolic panel": [
    {
      system: "LOINC",
      code: "24323-8",
      display: "Comprehensive metabolic 2000 panel - Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "complete blood count": [
    {
      system: "LOINC",
      code: "58410-2",
      display: "Complete blood count (hemogram) panel - Blood by Automated count",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "basic metabolic panel": [
    {
      system: "LOINC",
      code: "51990-0",
      display: "Basic metabolic 2000 panel - Blood",
      confidence: "low",
      status: "candidate",
      rationale: "Panel specimen and exact component set should be reviewed."
    }
  ],
  "liver function tests": [
    {
      system: "LOINC",
      code: "24325-3",
      display: "Hepatic function 2000 panel - Serum or Plasma",
      confidence: "low",
      status: "candidate",
      rationale: "LFT shorthand may refer to several local panel definitions."
    }
  ],
  "lipid panel": [
    {
      system: "LOINC",
      code: "24331-1",
      display: "Lipid panel - Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  hemoglobin: [
    {
      system: "LOINC",
      code: "718-7",
      display: "Hemoglobin [Mass/volume] in Blood",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "white blood cell count": [
    {
      system: "LOINC",
      code: "6690-2",
      display: "Leukocytes [#/volume] in Blood by Automated count",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "platelet count": [
    {
      system: "LOINC",
      code: "777-3",
      display: "Platelets [#/volume] in Blood by Automated count",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "thyroid stimulating hormone": [
    {
      system: "LOINC",
      code: "3016-3",
      display: "Thyrotropin [Units/volume] in Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  creatinine: [
    {
      system: "LOINC",
      code: "2160-0",
      display: "Creatinine [Mass/volume] in Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "estimated glomerular filtration rate": [
    {
      system: "LOINC",
      code: "33914-3",
      display: "Glomerular filtration rate/1.73 sq M.predicted",
      confidence: "low",
      status: "candidate",
      rationale: "eGFR method and equation are not specified in shorthand text."
    }
  ],
  "low density lipoprotein cholesterol": [
    {
      system: "LOINC",
      code: "13457-7",
      display: "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "high density lipoprotein cholesterol": [
    {
      system: "LOINC",
      code: "2085-9",
      display: "Cholesterol in HDL [Mass/volume] in Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  triglycerides: [
    {
      system: "LOINC",
      code: "2571-8",
      display: "Triglyceride [Mass/volume] in Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "total cholesterol": [
    {
      system: "LOINC",
      code: "2093-3",
      display: "Cholesterol [Mass/volume] in Serum or Plasma",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "major depressive disorder": [
    {
      system: "ICD-10-CM",
      code: "F32.9",
      display: "Major depressive disorder, single episode, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Major depression mention does not establish episode, recurrence, severity, or remission status."
    },
    {
      system: "SNOMED-CT",
      code: "370143000",
      display: "Major depressive disorder",
      confidence: "medium",
      status: "candidate"
    }
  ],
  depression: [
    {
      system: "ICD-10-CM",
      code: "F32.A",
      display: "Depression, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "35489007",
      display: "Depressive disorder",
      confidence: "low",
      status: "candidate"
    }
  ],
  "generalized anxiety disorder": [
    {
      system: "ICD-10-CM",
      code: "F41.1",
      display: "Generalized anxiety disorder",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "21897009",
      display: "Generalized anxiety disorder",
      confidence: "medium",
      status: "candidate"
    }
  ],
  anxiety: [
    {
      system: "ICD-10-CM",
      code: "F41.9",
      display: "Anxiety disorder, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "48694002",
      display: "Anxiety",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "post-traumatic stress disorder": [
    {
      system: "ICD-10-CM",
      code: "F43.10",
      display: "Post-traumatic stress disorder, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "47505003",
      display: "Posttraumatic stress disorder",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "auditory/visual hallucinations": [
    {
      system: "ICD-10-CM",
      code: "R44.3",
      display: "Hallucinations, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "7011001",
      display: "Hallucinations",
      confidence: "low",
      status: "candidate"
    }
  ],
  "Patient Health Questionnaire-9": [
    {
      system: "LOINC",
      code: "44261-6",
      display: "Patient Health Questionnaire 9 item total score",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "Generalized Anxiety Disorder-7": [
    {
      system: "LOINC",
      code: "70274-6",
      display: "Generalized anxiety disorder 7 item total score",
      confidence: "medium",
      status: "candidate"
    }
  ],
  sertraline: [
    {
      system: "RxNorm",
      code: "36437",
      display: "Sertraline",
      confidence: "medium",
      status: "candidate"
    }
  ],
  lisinopril: [
    {
      system: "RxNorm",
      code: "29046",
      display: "Lisinopril",
      confidence: "medium",
      status: "candidate"
    }
  ],
  metformin: [
    {
      system: "RxNorm",
      code: "6809",
      display: "Metformin",
      confidence: "medium",
      status: "candidate"
    }
  ],
  ibuprofen: [
    {
      system: "RxNorm",
      code: "5640",
      display: "Ibuprofen",
      confidence: "medium",
      status: "candidate"
    }
  ],
  acetaminophen: [
    {
      system: "RxNorm",
      code: "161",
      display: "Acetaminophen",
      confidence: "medium",
      status: "candidate"
    }
  ],
  albuterol: [
    {
      system: "RxNorm",
      code: "435",
      display: "Albuterol",
      confidence: "medium",
      status: "candidate"
    }
  ],
  atorvastatin: [
    {
      system: "RxNorm",
      code: "83367",
      display: "Atorvastatin",
      confidence: "medium",
      status: "candidate"
    }
  ],
  amlodipine: [
    {
      system: "RxNorm",
      code: "17767",
      display: "Amlodipine",
      confidence: "medium",
      status: "candidate"
    }
  ],
  losartan: [
    {
      system: "RxNorm",
      code: "52175",
      display: "Losartan",
      confidence: "medium",
      status: "candidate"
    }
  ],
  levothyroxine: [
    {
      system: "RxNorm",
      code: "10582",
      display: "Levothyroxine",
      confidence: "medium",
      status: "candidate"
    }
  ],
  omeprazole: [
    {
      system: "RxNorm",
      code: "7646",
      display: "Omeprazole",
      confidence: "medium",
      status: "candidate"
    }
  ],
  fluoxetine: [
    {
      system: "RxNorm",
      code: "4493",
      display: "Fluoxetine",
      confidence: "medium",
      status: "candidate"
    }
  ],
  escitalopram: [
    {
      system: "RxNorm",
      code: "321988",
      display: "Escitalopram",
      confidence: "medium",
      status: "candidate"
    }
  ],
  bupropion: [
    {
      system: "RxNorm",
      code: "42347",
      display: "Bupropion",
      confidence: "medium",
      status: "candidate"
    }
  ],
  duloxetine: [
    {
      system: "RxNorm",
      code: "72625",
      display: "Duloxetine",
      confidence: "medium",
      status: "candidate"
    }
  ],
  gabapentin: [
    {
      system: "RxNorm",
      code: "25480",
      display: "Gabapentin",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "low back pain": [
    {
      system: "ICD-10-CM",
      code: "M54.50",
      display: "Low back pain, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    },
    {
      system: "SNOMED-CT",
      code: "279039007",
      display: "Low back pain",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "shoulder pain": [
    {
      system: "ICD-10-CM",
      code: "M25.519",
      display: "Pain in unspecified shoulder",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Laterality and more specific location should be confirmed before final coding."
    },
    {
      system: "SNOMED-CT",
      code: "45326000",
      display: "Shoulder pain",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "neck pain": [
    {
      system: "ICD-10-CM",
      code: "M54.2",
      display: "Cervicalgia",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  "knee pain": [
    {
      system: "ICD-10-CM",
      code: "M25.569",
      display: "Pain in unspecified knee",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Laterality should be confirmed for final coding."
    }
  ],
  "hip pain": [
    {
      system: "ICD-10-CM",
      code: "M25.559",
      display: "Pain in unspecified hip",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Laterality should be confirmed for final coding."
    }
  ],
  "pain rating": [
    {
      system: "LOINC",
      code: "72514-3",
      display: "Pain severity - 0-10 verbal numeric rating [Score] - Reported",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "tobacco use": [
    {
      system: "SNOMED-CT",
      code: "110483000",
      display: "Tobacco user",
      confidence: "low",
      status: "candidate"
    }
  ],
  "alcohol use": [
    {
      system: "SNOMED-CT",
      code: "228273003",
      display: "Finding relating to alcohol drinking behavior",
      confidence: "low",
      status: "candidate"
    }
  ],
  "substance use": [
    {
      system: "SNOMED-CT",
      code: "66214007",
      display: "Substance abuse",
      confidence: "low",
      status: "candidate",
      rationale: "Broad candidate only; substance, pattern, and disorder criteria require confirmation."
    }
  ],
  "family history of diabetes mellitus": [
    {
      system: "SNOMED-CT",
      code: "160303001",
      display: "Family history of diabetes mellitus",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "family history of colon cancer": [
    {
      system: "SNOMED-CT",
      code: "312824007",
      display: "Family history of cancer of colon",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "gait abnormality": [
    {
      system: "SNOMED-CT",
      code: "22325002",
      display: "Abnormal gait",
      confidence: "medium",
      status: "candidate"
    }
  ],
  "fall risk": [
    {
      system: "SNOMED-CT",
      code: "129839007",
      display: "At risk for falls",
      confidence: "medium",
      status: "candidate"
    }
  ],
  colonoscopy: [
    {
      system: "CPT",
      code: "45378",
      display: "Diagnostic colonoscopy",
      confidence: "low",
      status: "candidate",
      rationale: "Generic diagnostic colonoscopy candidate; screening, biopsy, lesion removal, and payer context can change final coding."
    },
    {
      system: "SNOMED-CT",
      code: "73761001",
      display: "Colonoscopy",
      confidence: "medium",
      status: "candidate"
    }
  ],
  dysphagia: [
    {
      system: "ICD-10-CM",
      code: "R13.10",
      display: "Dysphagia, unspecified",
      version: FY_2026_ICD_10_CM,
      confidence: "low",
      status: "candidate",
      rationale: "Dysphagia type and phase are not established by a simple mention."
    },
    {
      system: "SNOMED-CT",
      code: "40739000",
      display: "Dysphagia",
      confidence: "medium",
      status: "candidate"
    }
  ],
  aphasia: [
    {
      system: "ICD-10-CM",
      code: "R47.01",
      display: "Aphasia",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  dysarthria: [
    {
      system: "ICD-10-CM",
      code: "R47.1",
      display: "Dysarthria and anarthria",
      version: FY_2026_ICD_10_CM,
      confidence: "medium",
      status: "candidate"
    }
  ],
  "modified barium swallow study": [
    {
      system: "CPT",
      code: "92611",
      display: "Motion fluoroscopic evaluation of swallowing function by cine or video recording",
      confidence: "low",
      status: "candidate",
      rationale: "Starter procedure candidate; local billing and documentation context must be reviewed."
    }
  ],
  "videofluoroscopic swallowing study": [
    {
      system: "CPT",
      code: "92611",
      display: "Motion fluoroscopic evaluation of swallowing function by cine or video recording",
      confidence: "low",
      status: "candidate",
      rationale: "Starter procedure candidate; local billing and documentation context must be reviewed."
    }
  ],
  "speech therapy": [
    {
      system: "CPT",
      code: "92507",
      display: "Treatment of speech, language, voice, communication, and/or auditory processing disorder",
      confidence: "low",
      status: "candidate",
      rationale: "Broad speech therapy treatment candidate; service details must be reviewed."
    }
  ]
};

export const localTerminologyLookup: TerminologyLookup = {
  lookupCandidates(input) {
    const key = getTerminologyLookupKey(input);
    const directCodings = terminologyByCanonicalName[key] ?? [];
    const dynamicCodings = lookupDynamicCodings(input);
    return [...directCodings, ...dynamicCodings].map((coding) => ({ ...coding }));
  }
};

export function lookupCandidateCodings(
  entity: TerminologyLookupInput,
  lookup: TerminologyLookup = localTerminologyLookup
) {
  return lookup.lookupCandidates(entity);
}

export function addCandidateCodings(
  entity: ClinicalEntity,
  lookup: TerminologyLookup = localTerminologyLookup
): ClinicalEntity {
  const codings = lookupCandidateCodings(entity, lookup);
  if (!codings.length) return entity;

  return {
    ...entity,
    codings
  };
}

function getTerminologyLookupKey(entity: TerminologyLookupInput) {
  if (entity.type === "medication" && entity.attributes?.normalizedTerm) {
    return entity.attributes.normalizedTerm;
  }

  if (entity.canonicalName === "medication dose" && entity.attributes?.normalizedTerm) {
    return entity.attributes.normalizedTerm;
  }

  return entity.canonicalName;
}

function lookupDynamicCodings(entity: TerminologyLookupInput): CandidateCoding[] {
  if (entity.type === "imaging") {
    return lookupImagingCodings(entity.attributes?.modality);
  }

  return [];
}

function lookupImagingCodings(modality?: string): CandidateCoding[] {
  if (!modality) return [];

  const normalizedModality = modality.toLowerCase();
  const imagingCodings: Record<string, CandidateCoding[]> = {
    mri: [
      {
        system: "SNOMED-CT",
        code: "113091000",
        display: "Magnetic resonance imaging",
        confidence: "low",
        status: "candidate",
        rationale: "Broad modality candidate; body site, contrast, and protocol should be reviewed before final coding."
      }
    ],
    ct: [
      {
        system: "SNOMED-CT",
        code: "77477000",
        display: "Computed tomography",
        confidence: "low",
        status: "candidate",
        rationale: "Broad modality candidate; body site, contrast, and protocol should be reviewed before final coding."
      }
    ],
    ultrasound: [
      {
        system: "SNOMED-CT",
        code: "16310003",
        display: "Ultrasonography",
        confidence: "low",
        status: "candidate",
        rationale: "Broad modality candidate; body site and protocol should be reviewed before final coding."
      }
    ],
    "x-ray": [
      {
        system: "SNOMED-CT",
        code: "363680008",
        display: "Radiographic imaging procedure",
        confidence: "low",
        status: "candidate",
        rationale: "Broad imaging candidate; view count and body site should be reviewed before final coding."
      }
    ]
  };

  return imagingCodings[normalizedModality] ?? [];
}
