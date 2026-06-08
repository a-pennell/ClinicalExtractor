import { describe, expect, it } from "vitest";
import { extractClinicalEntities, extractClinicalEntityDocument } from "./extractClinicalEntities";

describe("extractClinicalEntities", () => {
  it("normalizes primary care shorthand and marks denied symptoms absent", () => {
    const entities = extractClinicalEntities("HTN controlled. Denies CP/SOB. A1c 7.8.", {
      specialty: "primary-care"
    });

    expect(entities.find((entity) => entity.canonicalName === "hypertension")).toBeTruthy();
    expect(entities.find((entity) => entity.canonicalName === "hemoglobin A1c")?.attributes?.value).toBe("7.8");
    expect(entities.find((entity) => entity.canonicalName === "chest pain")?.attributes?.assertion).toBe("absent");
    expect(entities.find((entity) => entity.canonicalName === "shortness of breath")?.attributes?.assertion).toBe(
      "absent"
    );
  });

  it("dedupes equivalent mental health risk mentions", () => {
    const entities = extractClinicalEntities("Denies SI. No suicidal ideation today.", {
      specialty: "mental-health"
    });
    const suicidalIdeation = entities.find((entity) => entity.canonicalName === "suicidal ideation");

    expect(suicidalIdeation?.mentions).toHaveLength(2);
    expect(suicidalIdeation?.attributes?.assertion).toBe("absent");
  });

  it("extracts physical therapy measurements and duration", () => {
    const entities = extractClinicalEntities("AROM flex 110, abd 90. ER 4-/5. Cont 2x/wk x 4 wks.", {
      specialty: "physical-therapy"
    });

    expect(entities.find((entity) => entity.displayName === "ROM measurement")?.attributes?.unit).toBe("degrees");
    expect(entities.find((entity) => entity.displayName === "Strength grade")?.attributes?.scale).toBe("MMT");
    expect(entities.find((entity) => entity.displayName === "Duration")?.attributes?.duration).toBe("4 wks");
  });

  it("merges low back pain variants in mixed context", () => {
    const entities = extractClinicalEntities("LBP persists. Low back pain worse with lifting.", {
      specialty: "mixed"
    });
    const lowBackPain = entities.find((entity) => entity.canonicalName === "low back pain");

    expect(lowBackPain?.mentions).toHaveLength(2);
  });

  it("extracts f/u shorthand as a follow-up plan with interval", () => {
    const entities = extractClinicalEntities("F/u in 3 mo.", {
      specialty: "primary-care"
    });
    const followUp = entities.find((entity) => entity.canonicalName === "follow up");

    expect(followUp?.type).toBe("plan");
    expect(followUp?.attributes?.duration).toBe("3 mo");
    expect(followUp?.mentions.some((mention) => mention.text.toLowerCase().includes("f/u"))).toBe(true);
  });

  it("detects common mental health diagnoses and avoids nested shorthand false positives", () => {
    const entities = extractClinicalEntities("Major depression. Hx MDD and GAD. PTSD noted. Denies AVH. GAD-7 12.", {
      specialty: "mental-health"
    });

    expect(entities.find((entity) => entity.canonicalName === "major depressive disorder")?.mentions).toHaveLength(2);
    expect(entities.find((entity) => entity.canonicalName === "generalized anxiety disorder")?.mentions).toHaveLength(1);
    expect(entities.find((entity) => entity.canonicalName === "post-traumatic stress disorder")).toBeTruthy();
    expect(entities.find((entity) => entity.canonicalName === "auditory/visual hallucinations")?.attributes?.assertion).toBe(
      "absent"
    );
    expect(entities.find((entity) => entity.canonicalName === "Generalized Anxiety Disorder-7")?.attributes?.value).toBe(
      "12"
    );
    expect(entities.find((entity) => entity.canonicalName === "depression")).toBeFalsy();
  });

  it("adds starter candidate codings for mapped clinical entities", () => {
    const entities = extractClinicalEntities("Major depression. A1c 7.8. Started sertraline 50mg.", {
      specialty: "mixed"
    });

    expect(
      entities
        .find((entity) => entity.canonicalName === "major depressive disorder")
        ?.codings?.some((coding) => coding.system === "ICD-10-CM" && coding.code === "F32.9")
    ).toBe(true);
    expect(
      entities
        .find((entity) => entity.canonicalName === "hemoglobin A1c")
        ?.codings?.some((coding) => coding.system === "LOINC" && coding.code === "4548-4")
    ).toBe(true);
    expect(
      entities
        .find((entity) => entity.canonicalName === "sertraline")
        ?.codings?.some((coding) => coding.system === "RxNorm" && coding.code === "36437")
    ).toBe(true);
  });

  it("extracts medication sig details without merging different medications", () => {
    const entities = extractClinicalEntities(
      "Continue lisinopril 20mg PO daily. Start metformin 500 mg BID. Albuterol inhaler 2 puffs q4h PRN wheeze.",
      { specialty: "primary-care" }
    );

    const lisinopril = entities.find((entity) => entity.canonicalName === "lisinopril");
    const metformin = entities.find((entity) => entity.canonicalName === "metformin");
    const albuterol = entities.find((entity) => entity.canonicalName === "albuterol");

    expect(lisinopril?.attributes).toMatchObject({
      dose: "20 mg",
      route: "PO",
      frequency: "daily",
      sig: "20 mg PO daily"
    });
    expect(metformin?.attributes).toMatchObject({
      dose: "500 mg",
      frequency: "twice daily"
    });
    expect(albuterol?.attributes).toMatchObject({
      dose: "2 puff",
      route: "inhaled",
      frequency: "q4h",
      prn: true,
      indication: "wheeze"
    });
    expect(new Set(entities.filter((entity) => entity.type === "medication").map((entity) => entity.canonicalName))).toEqual(
      new Set(["lisinopril", "metformin", "albuterol"])
    );
  });

  it("extracts allergies with substance and reaction plus no-known-allergy shorthand", () => {
    const entities = extractClinicalEntities("Allergy: penicillin - rash. NKDA documented previously.", {
      specialty: "primary-care"
    });

    expect(entities.find((entity) => entity.canonicalName === "penicillin allergy")?.attributes).toMatchObject({
      assertion: "present",
      substance: "penicillin",
      reaction: "rash"
    });
    expect(entities.find((entity) => entity.canonicalName === "no known drug allergies")?.attributes?.assertion).toBe(
      "absent"
    );
  });

  it("extracts common vital sign shorthand with LOINC candidates", () => {
    const entities = extractClinicalEntities("BP 128/82, HR 88, RR 16, SpO2 98%, Temp 98.6 F, wt 180 lb.", {
      specialty: "primary-care"
    });

    expect(entities.find((entity) => entity.canonicalName === "blood pressure")?.attributes).toMatchObject({
      value: "128/82",
      systolic: "128",
      diastolic: "82",
      unit: "mmHg"
    });
    expect(entities.find((entity) => entity.canonicalName === "heart rate")?.attributes?.value).toBe("88");
    expect(entities.find((entity) => entity.canonicalName === "respiratory rate")?.attributes?.unit).toBe("breaths/min");
    expect(entities.find((entity) => entity.canonicalName === "oxygen saturation")?.attributes?.unit).toBe("%");
    expect(entities.find((entity) => entity.canonicalName === "body temperature")?.attributes?.unit).toBe("degF");
    expect(entities.find((entity) => entity.canonicalName === "body weight")?.codings?.[0].code).toBe("29463-7");
  });

  it("extracts common lab values with LOINC candidates", () => {
    const entities = extractClinicalEntities(
      "CBC ordered. Hgb 13.2, WBC 8.1, Plt 250. TSH 2.3, Cr 1.1, eGFR 72. LDL 130 HDL 45 TG 180.",
      { specialty: "primary-care" }
    );

    expect(entities.find((entity) => entity.canonicalName === "complete blood count")?.codings?.[0].code).toBe(
      "58410-2"
    );
    expect(entities.find((entity) => entity.canonicalName === "hemoglobin")?.attributes).toMatchObject({
      value: "13.2",
      unit: "g/dL"
    });
    expect(entities.find((entity) => entity.canonicalName === "white blood cell count")?.codings?.[0].code).toBe(
      "6690-2"
    );
    expect(entities.find((entity) => entity.canonicalName === "thyroid stimulating hormone")?.codings?.[0].code).toBe(
      "3016-3"
    );
    expect(entities.find((entity) => entity.canonicalName === "low density lipoprotein cholesterol")?.attributes?.unit).toBe(
      "mg/dL"
    );
  });

  it("extracts social and family history coverage", () => {
    const entities = extractClinicalEntities("Denies tobacco. EtOH social. FHx father with colon cancer.", {
      specialty: "primary-care"
    });

    expect(entities.find((entity) => entity.canonicalName === "tobacco use")?.attributes?.assertion).toBe("absent");
    expect(entities.find((entity) => entity.canonicalName === "alcohol use")?.attributes).toMatchObject({
      value: "social",
      assertion: "present"
    });
    expect(entities.find((entity) => entity.canonicalName === "family history of colon cancer")?.attributes).toMatchObject({
      assertion: "family-history",
      familyMember: "father"
    });
  });

  it("extracts imaging, referral, procedure, PT, and mental health coverage", () => {
    const entities = extractClinicalEntities(
      "Ordered MRI lumbar spine. Referral to PT. Colonoscopy scheduled. Antalgic gait and impaired balance. Safety plan reviewed. Panic attacks.",
      { specialty: "mixed" }
    );

    expect(entities.find((entity) => entity.canonicalName === "lumbar spine MRI")?.attributes).toMatchObject({
      assertion: "ordered",
      modality: "MRI",
      bodySite: "lumbar spine"
    });
    expect(entities.find((entity) => entity.canonicalName === "lumbar spine MRI")?.displayName).toBe("Lumbar Spine MRI");
    expect(
      entities
        .find((entity) => entity.canonicalName === "lumbar spine MRI")
        ?.codings?.some((coding) => coding.system === "SNOMED-CT" && coding.code === "113091000")
    ).toBe(true);
    expect(entities.find((entity) => entity.canonicalName === "referral to physical therapy")?.type).toBe("referral");
    expect(
      entities
        .find((entity) => entity.canonicalName === "colonoscopy")
        ?.codings?.some((coding) => coding.system === "CPT" && coding.code === "45378")
    ).toBe(true);
    expect(entities.find((entity) => entity.canonicalName === "gait abnormality")?.codings?.[0].code).toBe("22325002");
    expect(entities.find((entity) => entity.canonicalName === "impaired balance")?.type).toBe("functional-limitation");
    expect(entities.find((entity) => entity.canonicalName === "safety plan")?.attributes?.assertion).toBe("planned");
    expect(entities.find((entity) => entity.canonicalName === "panic attacks")?.type).toBe("symptom");
  });

  it("annotates mentions with note sections and uses family-history section context", () => {
    const entities = extractClinicalEntities("PMH: HTN.\nFamily Hx: father with colon cancer.\nPlan: HEP reviewed.", {
      specialty: "mixed"
    });

    expect(entities.find((entity) => entity.canonicalName === "hypertension")?.mentions[0].section).toBe(
      "past-medical-history"
    );
    expect(entities.find((entity) => entity.canonicalName === "hypertension")?.attributes?.temporality).toBe("past");
    expect(entities.find((entity) => entity.canonicalName === "family history of colon cancer")?.attributes).toMatchObject({
      assertion: "family-history",
      familyMember: "father"
    });
    expect(entities.find((entity) => entity.canonicalName === "home exercise program")?.attributes?.assertion).toBe(
      "planned"
    );
  });

  it("adds relation links between clinically related extracted entities", () => {
    const entities = extractClinicalEntities(
      "T2DM with A1c 8.1. Continue metformin 500mg BID. Major depression. Sertraline 50mg daily. LBP. Ordered MRI lumbar spine.",
      { specialty: "mixed" }
    );

    expect(
      entities
        .find((entity) => entity.canonicalName === "metformin")
        ?.relations?.some((relation) => relation.type === "treats" && relation.targetCanonicalName === "type 2 diabetes mellitus")
    ).toBe(true);
    expect(
      entities
        .find((entity) => entity.canonicalName === "hemoglobin A1c")
        ?.relations?.some((relation) => relation.type === "measures" && relation.targetCanonicalName === "type 2 diabetes mellitus")
    ).toBe(true);
    expect(
      entities
        .find((entity) => entity.canonicalName === "sertraline")
        ?.relations?.some((relation) => relation.type === "treats" && relation.targetCanonicalName === "major depressive disorder")
    ).toBe(true);
    expect(
      entities
        .find((entity) => entity.canonicalName === "lumbar spine MRI")
        ?.relations?.some((relation) => relation.type === "ordered-for" && relation.targetCanonicalName === "low back pain")
    ).toBe(true);
  });

  it("flags uncertain entities for reviewer attention", () => {
    const chestPainEntities = extractClinicalEntities("CP.", { specialty: "mixed" });
    const referralEntities = extractClinicalEntities("Referral to PT.", { specialty: "mixed" });

    expect(chestPainEntities.find((entity) => entity.canonicalName === "chest pain")?.uncertainty?.reviewPriority).toBe(
      "high"
    );
    expect(
      referralEntities.find((entity) => entity.canonicalName === "referral to physical therapy")?.uncertainty?.reasons
    ).toContain("No linked problem, symptom, or clinical target was inferred.");
  });

  it("extracts expanded primary care, mental health, and PT coverage", () => {
    const entities = extractClinicalEntities(
      "COPD and OSA. Start atorvastatin 40mg. AUDIT-C 5. C-SSRS 2. Knee pain with SLR positive. TUG 13 sec.",
      { specialty: "mixed" }
    );

    expect(entities.find((entity) => entity.canonicalName === "chronic obstructive pulmonary disease")?.codings?.[0].code).toBe(
      "J44.9"
    );
    expect(entities.find((entity) => entity.canonicalName === "obstructive sleep apnea")?.codings?.[0].code).toBe(
      "G47.33"
    );
    expect(entities.find((entity) => entity.canonicalName === "atorvastatin")?.attributes?.dose).toBe("40 mg");
    expect(
      entities.find(
        (entity) => entity.canonicalName === "Alcohol Use Disorders Identification Test-Consumption"
      )?.attributes?.value
    ).toBe("5");
    expect(entities.find((entity) => entity.canonicalName === "Columbia Suicide Severity Rating Scale")?.attributes?.value).toBe(
      "2"
    );
    expect(entities.find((entity) => entity.canonicalName === "straight leg raise")?.type).toBe("special-test");
    expect(entities.find((entity) => entity.canonicalName === "Timed Up and Go")?.attributes?.value).toBe("13");
  });

  it("auto-detects mixed clinical context without a selected specialty", () => {
    const document = extractClinicalEntityDocument(
      "T2DM with A1c 7.9 and major depression. PHQ-9 14. Referral to PT for ROM.",
      { mode: "auto" }
    );

    expect(document.context.primarySpecialty).toBe("mixed");
    expect(document.context.activeSpecialties).toEqual(
      expect.arrayContaining(["primary-care", "mental-health", "physical-therapy"])
    );
    expect(document.entities.find((entity) => entity.canonicalName === "type 2 diabetes mellitus")).toBeTruthy();
    expect(document.entities.find((entity) => entity.canonicalName === "major depressive disorder")).toBeTruthy();
    expect(document.entities.find((entity) => entity.canonicalName === "referral to physical therapy")).toBeTruthy();
  });

  it("extracts speech-language pathology and swallowing documentation concepts", () => {
    const entities = extractClinicalEntities(
      "SLP eval for dysphagia and dysarthria. MBSS ordered. Aspiration risk. Thickened liquids recommended.",
      { mode: "auto" }
    );

    expect(entities.find((entity) => entity.canonicalName === "speech-language pathology")?.disambiguation?.source).toBe(
      "ASHA Common Medical Abbreviations"
    );
    expect(entities.find((entity) => entity.canonicalName === "dysphagia")?.codings?.[0].code).toBe("R13.10");
    expect(entities.find((entity) => entity.canonicalName === "dysarthria")?.codings?.[0].code).toBe("R47.1");
    expect(entities.find((entity) => entity.canonicalName === "modified barium swallow study")?.codings?.[0].code).toBe(
      "92611"
    );
    expect(entities.find((entity) => entity.canonicalName === "aspiration risk")?.type).toBe("risk");
    expect(entities.find((entity) => entity.canonicalName === "diet texture modification")?.type).toBe("plan");
  });
});
