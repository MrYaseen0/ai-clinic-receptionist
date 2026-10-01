import type { LabTest, LabParam } from "./lab-store";

/**
 * Static 18-test catalog for Labortis Pro.
 *
 * This is reference data compiled into the app — it is NOT stored in the
 * database (neither JSON nor Postgres). Admin-created tests and edits to
 * catalog entries live in the `lab_tests` table (or the JSON file's tests
 * array in local-dev fallback mode) and are overlaid on top of this list.
 *
 * IDs are deterministic (TST-<CODE>) so orders, seeds, and the AI chat can
 * reference tests stably across restarts and environments.
 */

const STATIC_CREATED_AT = "2026-10-01T00:00:00.000Z";

type P = [string, string, string, number, number, number?, number?];
// key, name, unit, refLow, refHigh, criticalLow?, criticalHigh?

function params(list: P[]): LabParam[] {
  return list.map(([key, name, unit, refLow, refHigh, cL, cH]) => ({
    key,
    name,
    unit,
    refLow,
    refHigh,
    ...(cL !== undefined ? { criticalLow: cL } : {}),
    ...(cH !== undefined ? { criticalHigh: cH } : {}),
  }));
}

function test(def: {
  code: string;
  name: string;
  category: string;
  price: number;
  sampleType: string;
  turnaroundHrs: number;
  params: P[];
}): LabTest {
  return {
    id: `TST-${def.code}`,
    code: def.code,
    name: def.name,
    category: def.category,
    price: def.price,
    sampleType: def.sampleType,
    turnaroundHrs: def.turnaroundHrs,
    params: params(def.params),
    active: true,
    createdAt: STATIC_CREATED_AT,
  };
}

/** The full static catalog — do not mutate the returned array's entries. */
export function buildStaticCatalog(): LabTest[] {
  return [
    test({ code: "CBC", name: "Complete Blood Count (CBC)", category: "Hematology", price: 800, sampleType: "EDTA Blood", turnaroundHrs: 4,
      params: [
        ["hb", "Hemoglobin", "g/dL", 12.0, 16.0, 7.0, 20.0],
        ["wbc", "WBC Count", "x10^9/L", 4.0, 11.0, 2.0, 30.0],
        ["rbc", "RBC Count", "x10^12/L", 4.2, 5.4],
        ["plt", "Platelet Count", "x10^9/L", 150, 400, 50, 1000],
        ["mcv", "MCV", "fL", 80, 100],
      ] }),
    test({ code: "ESR", name: "ESR (Westergren)", category: "Hematology", price: 300, sampleType: "EDTA Blood", turnaroundHrs: 3,
      params: [["esr", "ESR", "mm/hr", 0, 20, undefined, 100]] }),
    test({ code: "LIPID", name: "Lipid Profile", category: "Biochemistry", price: 1500, sampleType: "Serum (Fasting)", turnaroundHrs: 6,
      params: [
        ["chol", "Total Cholesterol", "mg/dL", 125, 200, undefined, 300],
        ["tg", "Triglycerides", "mg/dL", 50, 150, undefined, 500],
        ["hdl", "HDL Cholesterol", "mg/dL", 40, 80],
        ["ldl", "LDL Cholesterol", "mg/dL", 0, 130, undefined, 190],
        ["vldl", "VLDL Cholesterol", "mg/dL", 5, 30],
      ] }),
    test({ code: "LFT", name: "Liver Function Test (LFT)", category: "Biochemistry", price: 1200, sampleType: "Serum", turnaroundHrs: 6,
      params: [
        ["bili", "Bilirubin Total", "mg/dL", 0.2, 1.2, undefined, 5.0],
        ["alt", "ALT (SGPT)", "U/L", 7, 56, undefined, 300],
        ["ast", "AST (SGOT)", "U/L", 10, 40, undefined, 300],
        ["alp", "Alkaline Phosphatase", "U/L", 44, 147],
        ["alb", "Albumin", "g/dL", 3.5, 5.5, 2.0],
      ] }),
    test({ code: "RFT", name: "Kidney Function Test (RFT)", category: "Biochemistry", price: 1200, sampleType: "Serum", turnaroundHrs: 6,
      params: [
        ["creat", "Creatinine", "mg/dL", 0.6, 1.2, undefined, 5.0],
        ["urea", "Urea", "mg/dL", 15, 45, undefined, 150],
        ["na", "Sodium", "mmol/L", 136, 145, 120, 160],
        ["k", "Potassium", "mmol/L", 3.5, 5.1, 2.8, 6.0],
      ] }),
    test({ code: "HBA1C", name: "HbA1c (Glycated Hemoglobin)", category: "Biochemistry", price: 900, sampleType: "EDTA Blood", turnaroundHrs: 4,
      params: [["hba1c", "HbA1c", "%", 4.0, 5.6, undefined, 10.0]] }),
    test({ code: "FBS", name: "Fasting Blood Sugar", category: "Biochemistry", price: 300, sampleType: "Fluoride Plasma", turnaroundHrs: 2,
      params: [["fbs", "Glucose Fasting", "mg/dL", 70, 100, 50, 300]] }),
    test({ code: "CRP", name: "C-Reactive Protein (CRP)", category: "Biochemistry", price: 1000, sampleType: "Serum", turnaroundHrs: 4,
      params: [["crp", "CRP", "mg/L", 0, 6, undefined, 100]] }),
    test({ code: "VITD", name: "Vitamin D (25-OH)", category: "Biochemistry", price: 2500, sampleType: "Serum", turnaroundHrs: 24,
      params: [["vitd", "Vitamin D", "ng/mL", 30, 100, 10]] }),
    test({ code: "B12", name: "Vitamin B12", category: "Biochemistry", price: 2200, sampleType: "Serum", turnaroundHrs: 24,
      params: [["b12", "Vitamin B12", "pg/mL", 200, 900, 150]] }),
    test({ code: "FERR", name: "Serum Ferritin", category: "Biochemistry", price: 1800, sampleType: "Serum", turnaroundHrs: 24,
      params: [["ferr", "Ferritin", "ng/mL", 30, 400, 10]] }),
    test({ code: "TFT", name: "Thyroid Profile (T3/T4/TSH)", category: "Endocrinology", price: 1800, sampleType: "Serum", turnaroundHrs: 8,
      params: [
        ["t3", "T3 Total", "ng/mL", 0.8, 2.0],
        ["t4", "T4 Total", "ug/dL", 5.0, 12.0],
        ["tsh", "TSH", "uIU/mL", 0.4, 4.0, 0.05, 20.0],
      ] }),
    test({ code: "URINE", name: "Urine Complete Examination", category: "Clinical Pathology", price: 400, sampleType: "Urine", turnaroundHrs: 3,
      params: [
        ["ph", "pH", "", 5.0, 8.0],
        ["sg", "Specific Gravity", "", 1.005, 1.03],
        ["pus", "Pus Cells", "/HPF", 0, 5, undefined, 50],
        ["rbc_u", "RBC", "/HPF", 0, 3],
      ] }),
    test({ code: "HBSAG", name: "HBsAg (Hepatitis B Screen)", category: "Immunology", price: 800, sampleType: "Serum", turnaroundHrs: 6,
      params: [["hbsag", "HBsAg Index", "S/CO", 0, 0.9, undefined, 5.0]] }),
    test({ code: "HCV", name: "Anti-HCV (Hepatitis C Screen)", category: "Immunology", price: 800, sampleType: "Serum", turnaroundHrs: 6,
      params: [["hcv", "Anti-HCV", "S/CO", 0, 0.9, undefined, 5.0]] }),
    test({ code: "DENGUE", name: "Dengue NS1 Antigen", category: "Immunology", price: 1500, sampleType: "Serum", turnaroundHrs: 4,
      params: [["ns1", "NS1 Antigen Index", "", 0, 0.9, undefined, 5.0]] }),
    test({ code: "BHCG", name: "Beta-hCG (Pregnancy)", category: "Immunology", price: 1500, sampleType: "Serum", turnaroundHrs: 6,
      params: [["bhcg", "Beta-hCG", "mIU/mL", 0, 5, undefined, 1000]] }),
    test({ code: "MP", name: "Malaria Parasite (MP)", category: "Parasitology", price: 500, sampleType: "EDTA Blood", turnaroundHrs: 3,
      params: [["mp", "Malarial Parasites", "/uL", 0, 0, undefined, 100]] }),
  ];
}

/** Canonical JSON: object keys sorted recursively, so semantic comparison is
 *  immune to key ordering (e.g. after a JSONB round-trip through Postgres). */
export function stableJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((v) => stableJson(v)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
