import fs from "fs";
import path from "path";

/**
 * Labortis Pro data layer — JSON-file persistence under data/lab.json,
 * same pattern as lib/bookings.ts.
 *
 * NOTE: On Vercel / serverless the filesystem is ephemeral — this demo
 * store is best-effort there. The roadmap is Supabase/Postgres for
 * permanent storage.
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

export function loadDb(): LabDb {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<LabDb>;
      cache = { ...emptyDb(), ...parsed };
      if (!cache.counters) cache.counters = { patientSerial: {}, orderSeq: {} };
      return cache;
    }
  } catch {
    // fall through to empty
  }
  cache = emptyDb();
  return cache;
}

export function saveDb(): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Demo mode: persistence is best-effort (read-only FS on serverless)
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

/** Patient serial: 0001-09-2026 (sequential per month-year). */
export function nextPatientSerial(now = new Date()): string {
  const db = loadDb();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const n = (db.counters.patientSerial[key] || 0) + 1;
  db.counters.patientSerial[key] = n;
  return `${String(n).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
}

/** Order id: LAB-2026-0001 (sequential per year). */
export function nextOrderId(now = new Date()): string {
  const db = loadDb();
  const key = String(now.getFullYear());
  const n = (db.counters.orderSeq[key] || 0) + 1;
  db.counters.orderSeq[key] = n;
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
