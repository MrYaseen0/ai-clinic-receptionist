import fs from "fs";
import path from "path";
import { getSql, dbAvailable, ensureSchema } from "./db";
import { buildStaticCatalog, stableJson } from "./lab-catalog";

/**
 * Labortis Pro data layer.
 *
 * Two backends, one API:
 *  - Neon Postgres (via lib/db.ts) when a database URL env var is present
 *    (production / preview / dev on Vercel through the Neon integration).
 *  - JSON-file persistence under data/lab.json as the local-dev fallback.
 *
 * All functions are async. Callers mutate the object returned by loadDb()
 * and persist with saveDb() — same pattern as before.
 *
 * The 18-test catalog is static in code (lib/lab-catalog.ts). Admin-created
 * tests and edits are stored as overrides (lab_tests table / JSON file) and
 * overlaid on the static list.
 */

export type OrderStatus =
  | "registered"
  | "sample_collected"
  | "in_lab"
  | "under_review"
  | "approved"
  | "report_released";

export type Priority = "routine" | "urgent" | "stat";

export type ResultFlag = "L" | "H" | "N" | "CL" | "CH";

export interface LabParam {
  key: string;
  name: string;
  unit: string;
  refLow: number;
  refHigh: number;
  criticalLow?: number;
  criticalHigh?: number;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number; // PKR
  sampleType: string;
  turnaroundHrs: number;
  params: LabParam[];
  active: boolean;
  createdAt: string;
}

export interface LabPatient {
  id: string;
  serial: string; // e.g. 0001-09-2026
  name: string;
  phone: string;
  age: number;
  gender: "male" | "female" | "other";
  address?: string;
  createdAt: string;
}

export interface ResultEntry {
  paramKey: string;
  value: number;
  flag: ResultFlag;
  enteredAt: string;
  enteredBy: string;
}

export interface StatusEvent {
  from: OrderStatus | null;
  to: OrderStatus;
  at: string;
  by: string;
  note?: string;
}

export interface CriticalAlert {
  id: string;
  orderId: string;
  paramName: string;
  value: number;
  unit: string;
  level: "critical_low" | "critical_high";
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  date: string;
  receivedBy: string;
}

export interface LabOrder {
  id: string; // LAB-2026-0001
  patientId: string;
  testIds: string[];
  referringDoctor: string;
  priority: Priority;
  status: OrderStatus;
  sampleDate: string; // YYYY-MM-DD
  barcode: string;
  results: Record<string, ResultEntry[]>; // testId -> entries
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  payments: Payment[];
  total: number; // PKR, snapshot of test prices at creation
  history: StatusEvent[];
  source: "counter" | "chat";
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: "reagent" | "consumable";
  lot: string;
  qty: number;
  unit: string;
  minStock: number;
  expiry: string; // YYYY-MM-DD
  supplier: string;
}

export interface QcRun {
  date: string; // YYYY-MM-DD
  value: number;
  violation?: string; // e.g. "1_3s", "2_2s", "R_4s"
}

export interface QcControl {
  id: string;
  name: string;
  paramName: string;
  unit: string;
  mean: number;
  sd: number;
  runs: QcRun[];
}

export interface LabDb {
  patients: LabPatient[];
  tests: LabTest[];
  orders: LabOrder[];
  alerts: CriticalAlert[];
  inventory: InventoryItem[];
  qc: QcControl[];
  counters: {
    patientSerial: Record<string, number>; // "2026-09" -> n
    orderSeq: Record<string, number>; // "2026" -> n
  };
  seeded: boolean;
}

const DATA_FILE = path.join(process.cwd(), "data", "lab.json");

let cache: LabDb | null = null;

function emptyDb(): LabDb {
  return {
    patients: [],
    tests: [],
    orders: [],
    alerts: [],
    inventory: [],
    qc: [],
    counters: { patientSerial: {}, orderSeq: {} },
    seeded: false,
  };
}

/** Static catalog overlaid with stored custom/override tests. */
function mergeTests(stored: LabTest[]): LabTest[] {
  const byId = new Map<string, LabTest>();
  for (const t of buildStaticCatalog()) byId.set(t.id, t);
  for (const t of stored) byId.set(t.id, t);
  return Array.from(byId.values());
}

function loadFile(): LabDb {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<LabDb>;
      const db = { ...emptyDb(), ...parsed };
      if (!db.counters) db.counters = { patientSerial: {}, orderSeq: {} };
      return db;
    }
  } catch {
    // fall through to empty
  }
  return emptyDb();
}

function saveFile(db: LabDb): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Demo mode: persistence is best-effort (read-only FS on serverless)
  }
}

const iso = (v: string | Date | null | undefined): string | undefined => {
  if (v === null || v === undefined) return undefined;
  return v instanceof Date ? v.toISOString() : String(v);
};

async function loadFromDb(): Promise<LabDb> {
  const sql = getSql()!;
  const [patientRows, orderRows, alertRows, invRows, qcRows, testRows, kvRows] =
    (await Promise.all([
      sql`SELECT id, serial, name, phone, age, gender, address, created_at FROM lab_patients`,
      sql`SELECT id, patient_id, test_ids, referring_doctor, priority, status, sample_date, barcode, results, review_note, reviewed_by, reviewed_at, payments, total, history, source, created_at FROM lab_orders`,
      sql`SELECT id, order_id, param_name, value, unit, level, acknowledged, acknowledged_by, acknowledged_at, created_at FROM lab_alerts`,
      sql`SELECT id, name, category, lot, qty, unit, min_stock, expiry, supplier FROM lab_inventory`,
      sql`SELECT id, name, param_name, unit, mean, sd, runs FROM lab_qc`,
      sql`SELECT id, data FROM lab_tests`,
      sql`SELECT key, value FROM lab_kv`,
    ])) as unknown as Array<Array<Record<string, unknown>>>;

  const db = emptyDb();

  db.patients = (patientRows as Array<Record<string, never>>).map((r) => {
    const row = r as unknown as {
      id: string;
      serial: string;
      name: string;
      phone: string;
      age: number;
      gender: string;
      address: string | null;
      created_at: string | Date;
    };
    const p: LabPatient = {
      id: row.id,
      serial: row.serial,
      name: row.name,
      phone: row.phone,
      age: Number(row.age),
      gender:
        row.gender === "male" || row.gender === "female" ? row.gender : "other",
      createdAt: iso(row.created_at)!,
    };
    if (row.address) p.address = row.address;
    return p;
  });

  db.orders = (orderRows as Array<Record<string, never>>).map((r) => {
    const row = r as unknown as {
      id: string;
      patient_id: string;
      test_ids: string[];
      referring_doctor: string;
      priority: string;
      status: string;
      sample_date: string;
      barcode: string;
      results: Record<string, ResultEntry[]>;
      review_note: string | null;
      reviewed_by: string | null;
      reviewed_at: string | Date | null;
      payments: Payment[];
      total: number | string;
      history: StatusEvent[];
      source: string;
      created_at: string | Date;
    };
    const o: LabOrder = {
      id: row.id,
      patientId: row.patient_id,
      testIds: row.test_ids || [],
      referringDoctor: row.referring_doctor,
      priority: (row.priority as Priority) || "routine",
      status: row.status as OrderStatus,
      sampleDate: row.sample_date,
      barcode: row.barcode,
      results: row.results || {},
      payments: row.payments || [],
      total: Number(row.total),
      history: row.history || [],
      source: row.source === "chat" ? "chat" : "counter",
      createdAt: iso(row.created_at)!,
    };
    if (row.review_note) o.reviewNote = row.review_note;
    if (row.reviewed_by) o.reviewedBy = row.reviewed_by;
    const ra = iso(row.reviewed_at);
    if (ra) o.reviewedAt = ra;
    return o;
  });

  db.alerts = (alertRows as Array<Record<string, never>>).map((r) => {
    const row = r as unknown as {
      id: string;
      order_id: string;
      param_name: string;
      value: number | string;
      unit: string;
      level: string;
      acknowledged: boolean;
      acknowledged_by: string | null;
      acknowledged_at: string | Date | null;
      created_at: string | Date;
    };
    const a: CriticalAlert = {
      id: row.id,
      orderId: row.order_id,
      paramName: row.param_name,
      value: Number(row.value),
      unit: row.unit,
      level:
        row.level === "critical_low" ? "critical_low" : "critical_high",
      acknowledged: !!row.acknowledged,
      createdAt: iso(row.created_at)!,
    };
    if (row.acknowledged_by) a.acknowledgedBy = row.acknowledged_by;
    const aa = iso(row.acknowledged_at);
    if (aa) a.acknowledgedAt = aa;
    return a;
  });

  db.inventory = (invRows as Array<Record<string, never>>).map((r) => {
    const row = r as unknown as {
      id: string;
      name: string;
      category: string;
      lot: string;
      qty: number | string;
      unit: string;
      min_stock: number | string;
      expiry: string;
      supplier: string;
    };
    return {
      id: row.id,
      name: row.name,
      category: row.category === "reagent" ? "reagent" : "consumable",
      lot: row.lot,
      qty: Number(row.qty),
      unit: row.unit,
      minStock: Number(row.min_stock),
      expiry: row.expiry,
      supplier: row.supplier,
    } as InventoryItem;
  });

  db.qc = (qcRows as Array<Record<string, never>>).map((r) => {
    const row = r as unknown as {
      id: string;
      name: string;
      param_name: string;
      unit: string;
      mean: number | string;
      sd: number | string;
      runs: QcRun[];
    };
    return {
      id: row.id,
      name: row.name,
      paramName: row.param_name,
      unit: row.unit,
      mean: Number(row.mean),
      sd: Number(row.sd),
      runs: row.runs || [],
    } as QcControl;
  });

  const storedTests = (testRows as Array<{ id: string; data: LabTest }>)
    .map((r) => r.data)
    .filter(Boolean);
  db.tests = mergeTests(storedTests);

  for (const kv of kvRows as Array<{ key: string; value: unknown }>) {
    if (kv.key === "counters" && kv.value && typeof kv.value === "object") {
      const v = kv.value as Partial<LabDb["counters"]>;
      db.counters = {
        patientSerial: v.patientSerial || {},
        orderSeq: v.orderSeq || {},
      };
    }
    if (kv.key === "seeded") db.seeded = kv.value === true;
  }

  return db;
}

async function saveToDb(db: LabDb): Promise<void> {
  const sql = getSql()!;
  type Pending = ReturnType<typeof sql>;
  const queries: Pending[] = [];

  // Deletes first (children before parents), then inserts (parents first).
  queries.push(sql`DELETE FROM lab_alerts`);
  queries.push(sql`DELETE FROM lab_orders`);
  queries.push(sql`DELETE FROM lab_patients`);
  queries.push(sql`DELETE FROM lab_inventory`);
  queries.push(sql`DELETE FROM lab_qc`);

  for (const p of db.patients) {
    queries.push(sql`
      INSERT INTO lab_patients (id, serial, name, phone, age, gender, address, created_at)
      VALUES (${p.id}, ${p.serial}, ${p.name}, ${p.phone}, ${p.age}, ${p.gender}, ${p.address ?? null}, ${p.createdAt}::timestamptz)
    `);
  }
  for (const o of db.orders) {
    queries.push(sql`
      INSERT INTO lab_orders (id, patient_id, test_ids, referring_doctor, priority, status, sample_date, barcode, results, review_note, reviewed_by, reviewed_at, payments, total, history, source, created_at)
      VALUES (${o.id}, ${o.patientId}, ${JSON.stringify(o.testIds)}::jsonb, ${o.referringDoctor}, ${o.priority}, ${o.status}, ${o.sampleDate}, ${o.barcode}, ${JSON.stringify(o.results)}::jsonb, ${o.reviewNote ?? null}, ${o.reviewedBy ?? null}, CAST(${o.reviewedAt ?? null} AS timestamptz), ${JSON.stringify(o.payments)}::jsonb, ${o.total}, ${JSON.stringify(o.history)}::jsonb, ${o.source}, ${o.createdAt}::timestamptz)
    `);
  }
  for (const a of db.alerts) {
    queries.push(sql`
      INSERT INTO lab_alerts (id, order_id, param_name, value, unit, level, acknowledged, acknowledged_by, acknowledged_at, created_at)
      VALUES (${a.id}, ${a.orderId}, ${a.paramName}, ${a.value}, ${a.unit}, ${a.level}, ${a.acknowledged}, ${a.acknowledgedBy ?? null}, CAST(${a.acknowledgedAt ?? null} AS timestamptz), ${a.createdAt}::timestamptz)
    `);
  }
  for (const i of db.inventory) {
    queries.push(sql`
      INSERT INTO lab_inventory (id, name, category, lot, qty, unit, min_stock, expiry, supplier)
      VALUES (${i.id}, ${i.name}, ${i.category}, ${i.lot}, ${i.qty}, ${i.unit}, ${i.minStock}, ${i.expiry}, ${i.supplier})
    `);
  }
  for (const c of db.qc) {
    queries.push(sql`
      INSERT INTO lab_qc (id, name, param_name, unit, mean, sd, runs)
      VALUES (${c.id}, ${c.name}, ${c.paramName}, ${c.unit}, ${c.mean}, ${c.sd}, ${JSON.stringify(c.runs)}::jsonb)
    `);
  }

  // Seeded flag (counters are managed atomically and never overwritten here).
  queries.push(sql`
    INSERT INTO lab_kv (key, value) VALUES ('seeded', ${JSON.stringify(db.seeded)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);

  // Test overrides: only custom tests or edits that differ from the static catalog.
  const staticJson = new Map(
    buildStaticCatalog().map((t) => [t.id, stableJson(t)])
  );
  for (const t of db.tests) {
    const s = staticJson.get(t.id);
    if (s === undefined || s !== stableJson(t)) {
      queries.push(sql`
        INSERT INTO lab_tests (id, data) VALUES (${t.id}, ${JSON.stringify(t)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
      `);
    }
  }

  await sql.transaction(queries);
}

export async function loadDb(): Promise<LabDb> {
  if (cache) return cache;
  if (dbAvailable()) {
    await ensureSchema();
    cache = await loadFromDb();
  } else {
    cache = loadFile();
    if (cache.tests.length === 0) cache.tests = buildStaticCatalog();
  }
  return cache;
}

export async function saveDb(): Promise<void> {
  if (!cache) return;
  if (dbAvailable()) {
    await saveToDb(cache);
  } else {
    saveFile(cache);
  }
}

/** Reset the in-memory cache (used by tests/seed flows). */
export function resetCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Input sanitation helpers (Pydantic-style boundary validation, in TS)
// ---------------------------------------------------------------------------

/** Strip HTML tags so stored values can never carry markup/script. */
export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

export function cleanText(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return stripTags(v).trim().slice(0, maxLen);
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidPhone(s: string): boolean {
  return /^[+\d][\d\s\-]{6,15}$/.test(s) && s.replace(/\D/g, "").length >= 7;
}

// ---------------------------------------------------------------------------
// ID / serial generation
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

/**
 * Atomic counter bump. In DB mode this is a single atomic UPDATE statement
 * (safe across concurrent serverless instances); in JSON mode it mutates the
 * in-memory counters exactly as before.
 */
async function bumpCounter(
  group: "patientSerial" | "orderSeq",
  key: string
): Promise<number> {
  const sql = getSql()!;
  await sql`INSERT INTO lab_kv (key, value)
    VALUES ('counters', '{"patientSerial":{},"orderSeq":{}}'::jsonb)
    ON CONFLICT (key) DO NOTHING`;
  const rows = (await sql`
    UPDATE lab_kv
    SET value = jsonb_set(value, ARRAY[${group}, ${key}],
      to_jsonb(COALESCE((value -> ${group} ->> ${key})::int, 0) + 1))
    WHERE key = 'counters'
    RETURNING (value -> ${group} ->> ${key})::int AS n
  `) as unknown as Array<{ n: number }>;
  return rows[0].n;
}

/** Patient serial: 0001-09-2026 (sequential per month-year). */
export async function nextPatientSerial(now = new Date()): Promise<string> {
  const db = await loadDb();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let n: number;
  if (dbAvailable()) {
    n = await bumpCounter("patientSerial", key);
    db.counters.patientSerial[key] = n;
  } else {
    n = (db.counters.patientSerial[key] || 0) + 1;
    db.counters.patientSerial[key] = n;
  }
  return `${String(n).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
}

/** Order id: LAB-2026-0001 (sequential per year). */
export async function nextOrderId(now = new Date()): Promise<string> {
  const db = await loadDb();
  const key = String(now.getFullYear());
  let n: number;
  if (dbAvailable()) {
    n = await bumpCounter("orderSeq", key);
    db.counters.orderSeq[key] = n;
  } else {
    n = (db.counters.orderSeq[key] || 0) + 1;
    db.counters.orderSeq[key] = n;
  }
  return `LAB-${key}-${String(n).padStart(4, "0")}`;
}

export function makeBarcode(orderId: string): string {
  return `*${orderId}*`;
}

export function newPatientId(): string {
  return uid("PT");
}
export function newTestId(): string {
  return uid("TST");
}
export function newAlertId(): string {
  return uid("ALT");
}
export function newPaymentId(): string {
  return uid("PAY");
}
export function newItemId(): string {
  return uid("INV");
}
export function newQcId(): string {
  return uid("QC");
}

// ---------------------------------------------------------------------------
// Order workflow state machine
// ---------------------------------------------------------------------------

export const ORDER_STATUSES: OrderStatus[] = [
  "registered",
  "sample_collected",
  "in_lab",
  "under_review",
  "approved",
  "report_released",
];

/** Legal transitions — enforced server-side on every status change. */
export const LEGAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  registered: ["sample_collected"],
  sample_collected: ["in_lab"],
  in_lab: ["under_review"],
  under_review: ["approved", "in_lab"], // reject sends it back to the lab
  approved: ["report_released"],
  report_released: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function statusLabel(s: OrderStatus): string {
  return {
    registered: "Registered",
    sample_collected: "Sample Collected",
    in_lab: "In Lab",
    under_review: "Under Review",
    approved: "Approved",
    report_released: "Report Released",
  }[s];
}

// ---------------------------------------------------------------------------
// Result flagging (H/L/N) + critical value detection
// ---------------------------------------------------------------------------

export function flagValue(param: LabParam, value: number): ResultFlag {
  if (param.criticalLow !== undefined && value <= param.criticalLow)
    return "CL";
  if (param.criticalHigh !== undefined && value >= param.criticalHigh)
    return "CH";
  if (value < param.refLow) return "L";
  if (value > param.refHigh) return "H";
  return "N";
}

export function latestResults(order: LabOrder): Record<string, ResultEntry> {
  const out: Record<string, ResultEntry> = {};
  for (const [testId, entries] of Object.entries(order.results)) {
    for (const e of entries) out[`${testId}:${e.paramKey}`] = e;
  }
  return out;
}

/** All params across the order's tests that still need a result. */
export function pendingParams(
  order: LabOrder,
  testsById: Record<string, LabTest>
): Array<{ testId: string; test: LabTest; param: LabParam }> {
  const done = new Set(
    Object.values(order.results)
      .flat()
      .map((e) => e.paramKey)
  );
  const out: Array<{ testId: string; test: LabTest; param: LabParam }> = [];
  for (const tid of order.testIds) {
    const t = testsById[tid];
    if (!t) continue;
    for (const p of t.params) {
      if (!done.has(p.key)) out.push({ testId: tid, test: t, param: p });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Money / invoices
// ---------------------------------------------------------------------------

export function orderTotal(order: LabOrder): number {
  return order.total;
}

export function amountPaid(order: LabOrder): number {
  return order.payments.reduce((s, p) => s + p.amount, 0);
}

export function balanceDue(order: LabOrder): number {
  return Math.max(0, order.total - amountPaid(order));
}
