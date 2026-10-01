import {
  loadDb,
  saveDb,
  nextPatientSerial,
  nextOrderId,
  makeBarcode,
  newPatientId,
  newAlertId,
  newPaymentId,
  newItemId,
  newQcId,
  flagValue,
  type LabTest,
  type LabOrder,
  type LabPatient,
  type ResultEntry,
  type QcRun,
} from "./lab-store";
import { buildStaticCatalog } from "./lab-catalog";

/** Deterministic pseudo-random for reproducible QC runs. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function resultEntry(
  param: { key: string; name: string },
  value: number,
  flag: ResultEntry["flag"],
  by: string,
  daysAgo: number
): ResultEntry {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    paramKey: param.key,
    value,
    flag,
    enteredAt: d.toISOString(),
    enteredBy: by,
  };
}

function fillResults(
  order: LabOrder,
  testsByCode: Record<string, LabTest>,
  values: Record<string, Record<string, number>>, // testCode -> paramKey -> value
  by: string,
  daysAgo: number
): void {
  for (const [code, pv] of Object.entries(values)) {
    const t = testsByCode[code];
    if (!t) continue;
    const entries: ResultEntry[] = [];
    for (const [pkey, val] of Object.entries(pv)) {
      const p = t.params.find((x) => x.key === pkey);
      if (p) entries.push(resultEntry(p, val, flagValue(p, val), by, daysAgo));
    }
    if (entries.length) order.results[t.id] = entries;
  }
}

function mkHistory(
  path: Array<[string | null, string]>,
  by: string,
  daysAgo: number
): LabOrder["history"] {
  return path.map(([from, to], i) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysAgo + path.length - i));
    return {
      from: from as LabOrder["history"][number]["from"],
      to: to as LabOrder["history"][number]["to"],
      at: d.toISOString(),
      by,
    };
  });
}

/**
 * Seed demo data on first run. Returns true when seeding happened.
 * The 18-test catalog itself is static in code (lib/lab-catalog.ts) and is
 * not seeded — only patients, orders, alerts, inventory and QC runs are.
 */
export async function seedIfEmpty(): Promise<boolean> {
  const db = await loadDb();
  // NOTE: db.tests is always non-empty (static catalog), so the guard looks
  // at patients/orders instead.
  if (db.seeded || db.patients.length > 0 || db.orders.length > 0)
    return false;

  const tests = buildStaticCatalog();
  const byCode: Record<string, LabTest> = {};
  for (const t of tests) byCode[t.code] = t;

  // --- Patients ---
  const pdefs: Array<[string, string, number, "male" | "female" | "other", string?]> = [
    ["Ahmed Khan", "03001234567", 45, "male", "Gulbahar, Peshawar"],
    ["Fatima Bibi", "03339876543", 32, "female", "University Town, Peshawar"],
    ["Muhammad Tariq", "03459012345", 58, "male", "Hayatabad Phase 2"],
    ["Ayesha Siddiqui", "03128765432", 27, "female", "Saddar, Peshawar"],
    ["Bilal Ahmed", "03017654321", 39, "male", "Kohat Road, Peshawar"],
    ["Nazia Parveen", "03216549870", 51, "female", "Dalazak Road, Peshawar"],
  ];
  const patients: LabPatient[] = [];
  for (const [name, phone, age, gender, address] of pdefs) {
    patients.push({
      id: newPatientId(),
      serial: await nextPatientSerial(),
      name,
      phone,
      age,
      gender,
      address,
      createdAt: new Date().toISOString(),
    });
  }
  db.patients = patients;

  const orderFor = async (
    patientIdx: number,
    codes: string[],
    referringDoctor: string,
    priority: LabOrder["priority"],
    status: LabOrder["status"],
    sampleDaysAgo: number,
    source: LabOrder["source"] = "counter"
  ): Promise<LabOrder> => {
    const id = await nextOrderId();
    const testIds = codes.map((c) => byCode[c].id);
    const total = codes.reduce((s, c) => s + byCode[c].price, 0);
    const d = new Date();
    d.setDate(d.getDate() - sampleDaysAgo);
    const steps: Array<[string | null, string]> = [];
    const chain = ["registered", "sample_collected", "in_lab", "under_review", "approved", "report_released"];
    const idx = chain.indexOf(status);
    let prev: string | null = null;
    for (let i = 0; i <= idx; i++) {
      steps.push([prev, chain[i]]);
      prev = chain[i];
    }
    return {
      id,
      patientId: patients[patientIdx].id,
      testIds,
      referringDoctor,
      priority,
      status,
      sampleDate: d.toISOString().slice(0, 10),
      barcode: makeBarcode(id),
      results: {},
      payments: [],
      total,
      history: mkHistory(steps, "demo", sampleDaysAgo),
      source,
      createdAt: new Date(d.getTime() - 3600_000).toISOString(),
    };
  };

  // O1: registered (today)
  const o1 = await orderFor(0, ["CBC"], "Dr. Imran Sheikh", "routine", "registered", 0);
  // O2: sample_collected
  const o2 = await orderFor(1, ["LIPID", "FBS"], "Dr. Sara Malik", "urgent", "sample_collected", 1);
  // O3: in_lab, partial results (normal)
  const o3 = await orderFor(2, ["CBC", "ESR"], "Dr. Imran Sheikh", "routine", "in_lab", 2);
  fillResults(o3, byCode, {
    CBC: { hb: 14.2, wbc: 7.1, rbc: 4.8, plt: 230, mcv: 88 },
  }, "tech.demo", 1);
  // O4: in_lab, full results with an H flag
  const o4 = await orderFor(3, ["LFT"], "Dr. Kamran Ali", "stat", "in_lab", 2);
  fillResults(o4, byCode, {
    LFT: { bili: 1.8, alt: 62, ast: 45, alp: 120, alb: 4.1 },
  }, "tech.demo", 1);
  // O5: under_review with CRITICAL low Hb (unacknowledged alert)
  const o5 = await orderFor(4, ["CBC"], "Dr. Sara Malik", "urgent", "under_review", 3);
  fillResults(o5, byCode, {
    CBC: { hb: 6.4, wbc: 9.2, rbc: 3.1, plt: 180, mcv: 74 },
  }, "tech.demo", 2);
  // O6: approved (all normal)
  const o6 = await orderFor(5, ["TFT"], "Dr. Imran Sheikh", "routine", "approved", 4);
  fillResults(o6, byCode, {
    TFT: { t3: 1.4, t4: 8.2, tsh: 2.1 },
  }, "tech.demo", 3);
  o6.reviewedBy = "path.demo";
  o6.reviewNote = "Results verified. Within normal limits.";
  o6.reviewedAt = new Date(Date.now() - 2 * 86400_000).toISOString();
  // O7: report_released, paid in full, diabetic range HbA1c
  const o7 = await orderFor(0, ["HBA1C"], "Dr. Kamran Ali", "routine", "report_released", 5);
  fillResults(o7, byCode, { HBA1C: { hba1c: 8.2 } }, "tech.demo", 4);
  o7.reviewedBy = "path.demo";
  o7.reviewNote = "Diabetic range. Advise physician follow-up.";
  o7.reviewedAt = new Date(Date.now() - 4 * 86400_000).toISOString();
  o7.payments = [{
    id: newPaymentId(), amount: 900, method: "cash",
    date: new Date(Date.now() - 5 * 86400_000).toISOString(), receivedBy: "recep.demo",
  }];
  // O8: report_released, partially paid
  const o8 = await orderFor(1, ["URINE", "CRP"], "Dr. Sara Malik", "routine", "report_released", 6);
  fillResults(o8, byCode, {
    URINE: { ph: 6.0, sg: 1.02, pus: 8, rbc_u: 1 },
    CRP: { crp: 18 },
  }, "tech.demo", 5);
  o8.reviewedBy = "path.demo";
  o8.reviewNote = "UTI suspected — pus cells and CRP raised.";
  o8.reviewedAt = new Date(Date.now() - 5 * 86400_000).toISOString();
  o8.payments = [{
    id: newPaymentId(), amount: 500, method: "easypaisa",
    date: new Date(Date.now() - 6 * 86400_000).toISOString(), receivedBy: "recep.demo",
  }];

  db.orders = [o1, o2, o3, o4, o5, o6, o7, o8];

  // Critical alerts derived from results
  for (const o of db.orders) {
    for (const tid of o.testIds) {
      const t = tests.find((x) => x.id === tid);
      if (!t) continue;
      for (const e of o.results[tid] || []) {
        if (e.flag === "CL" || e.flag === "CH") {
          const p = t.params.find((x) => x.key === e.paramKey)!;
          db.alerts.push({
            id: newAlertId(),
            orderId: o.id,
            paramName: `${t.code} — ${p.name}`,
            value: e.value,
            unit: p.unit,
            level: e.flag === "CL" ? "critical_low" : "critical_high",
            acknowledged: false,
            createdAt: e.enteredAt,
          });
        }
      }
    }
  }

  // --- Inventory ---
  const exp = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  db.inventory = [
    { id: newItemId(), name: "CBC Reagent Pack (5-part diff)", category: "reagent", lot: "CBX-2408-A", qty: 2, unit: "packs", minStock: 5, expiry: exp(400), supplier: "MediLab Supplies" },
    { id: newItemId(), name: "Lipid Reagent Kit", category: "reagent", lot: "LPD-2501-B", qty: 12, unit: "kits", minStock: 4, expiry: exp(300), supplier: "MediLab Supplies" },
    { id: newItemId(), name: "Glucose Test Strips", category: "consumable", lot: "GLS-2510-C", qty: 500, unit: "strips", minStock: 200, expiry: exp(500), supplier: "Pak Diagnostics" },
    { id: newItemId(), name: "Urine Dipsticks (10-param)", category: "consumable", lot: "URN-2506-D", qty: 300, unit: "strips", minStock: 100, expiry: exp(250), supplier: "Pak Diagnostics" },
    { id: newItemId(), name: "Dengue NS1 Rapid Kits", category: "consumable", lot: "DEN-2509-E", qty: 40, unit: "kits", minStock: 20, expiry: exp(18), supplier: "RapidTest Co." },
    { id: newItemId(), name: "EDTA Vacutainer Tubes", category: "consumable", lot: "EDT-2503-F", qty: 1000, unit: "tubes", minStock: 300, expiry: exp(600), supplier: "MediLab Supplies" },
  ];

  // --- QC controls with deterministic runs ---
  const mkRuns = (mean: number, sd: number, n: number, seed: number, spikeIdx: number, spikeSd: number): QcRun[] => {
    const rnd = mulberry32(seed);
    const runs: QcRun[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (n - i));
      let v = mean + (rnd() * 2 - 1) * 1.6 * sd;
      if (i === spikeIdx) v = mean + spikeSd * sd;
      runs.push({ date: d.toISOString().slice(0, 10), value: Math.round(v * 100) / 100 });
    }
    return runs;
  };
  db.qc = [
    {
      id: newQcId(), name: "CBC Control Level 1", paramName: "Hemoglobin", unit: "g/dL",
      mean: 13.5, sd: 0.3,
      runs: mkRuns(13.5, 0.3, 20, 42, 13, 3.2), // one 1_3s violation
    },
    {
      id: newQcId(), name: "Glucose Control Level 2", paramName: "Glucose", unit: "mg/dL",
      mean: 180, sd: 6,
      runs: (() => { const r = mkRuns(180, 6, 20, 7, -1, 0); r[16].value = 193.5; r[17].value = 194.2; return r; })(), // 2_2s pair
    },
  ];
  // Evaluate violations on seeded runs
  for (const c of db.qc) {
    const rs = c.runs;
    for (let i = 0; i < rs.length; i++) {
      const z = (rs[i].value - c.mean) / c.sd;
      if (Math.abs(z) > 3) rs[i].violation = "1_3s";
      else if (Math.abs(z) > 2) {
        const prev = i > 0 ? (rs[i - 1].value - c.mean) / c.sd : 0;
        rs[i].violation = Math.abs(prev) > 2 && Math.sign(prev) === Math.sign(z) ? "2_2s" : "1_2s warn";
      }
    }
  }

  db.seeded = true;
  await saveDb();
  return true;
}

export { isoDaysAgo, isoToday };
