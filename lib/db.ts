import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon Postgres access layer.
 *
 * - The `sql` client is created lazily and ONLY when a database URL env var
 *   is present (Vercel auto-injects DATABASE_URL / POSTGRES_URL /
 *   POSTGRES_PRISMA_URL via the Neon integration). Locally, with no env var,
 *   `getSql()` returns null and callers fall back to JSON-file storage.
 * - Connection strings are never logged or exposed.
 */

function dbUrl(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    null
  );
}

let _sql: NeonQueryFunction<false, false> | null | undefined;

export function getSql(): NeonQueryFunction<false, false> | null {
  if (_sql === undefined) {
    const url = dbUrl();
    _sql = url ? neon(url) : null;
  }
  return _sql;
}

export function dbAvailable(): boolean {
  return getSql() !== null;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    doctor TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    specialty TEXT NOT NULL,
    fee DOUBLE PRECISION NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (phone)`,

  `CREATE TABLE IF NOT EXISTS lab_patients (
    id TEXT PRIMARY KEY,
    serial TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER NOT NULL DEFAULT 0,
    gender TEXT NOT NULL DEFAULT 'other',
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_patients_phone ON lab_patients (phone)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_patients_serial ON lab_patients (serial)`,

  `CREATE TABLE IF NOT EXISTS lab_orders (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES lab_patients (id) ON DELETE CASCADE,
    test_ids JSONB NOT NULL DEFAULT '[]',
    referring_doctor TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'routine',
    status TEXT NOT NULL DEFAULT 'registered',
    sample_date TEXT NOT NULL DEFAULT '',
    barcode TEXT NOT NULL DEFAULT '',
    results JSONB NOT NULL DEFAULT '{}',
    review_note TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    payments JSONB NOT NULL DEFAULT '[]',
    total DOUBLE PRECISION NOT NULL DEFAULT 0,
    history JSONB NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'counter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders (status)`,

  `CREATE TABLE IF NOT EXISTS lab_alerts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES lab_orders (id) ON DELETE CASCADE,
    param_name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lab_alerts_order ON lab_alerts (order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lab_alerts_unacked ON lab_alerts (acknowledged)`,

  `CREATE TABLE IF NOT EXISTS lab_inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    lot TEXT NOT NULL DEFAULT '',
    qty DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
    expiry TEXT NOT NULL DEFAULT '',
    supplier TEXT NOT NULL DEFAULT ''
  )`,

  `CREATE TABLE IF NOT EXISTS lab_qc (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    param_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    mean DOUBLE PRECISION NOT NULL,
    sd DOUBLE PRECISION NOT NULL,
    runs JSONB NOT NULL DEFAULT '[]'
  )`,

  // Custom / overridden lab tests only. The 18-test seed catalog is static
  // in code (lib/lab-catalog.ts) and is never stored here.
  `CREATE TABLE IF NOT EXISTS lab_tests (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,

  // Small key/value store: 'counters' -> { patientSerial: {...}, orderSeq: {...} },
  // 'seeded' -> true
  `CREATE TABLE IF NOT EXISTS lab_kv (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  )`,
];

let _schemaPromise: Promise<void> | null = null;

/**
 * Create all tables/indexes if they don't exist. Idempotent — safe to run
 * on every cold start. No-op when no database is configured.
 */
export function ensureSchema(): Promise<void> {
  const sql = getSql();
  if (!sql) return Promise.resolve();
  if (!_schemaPromise) {
    _schemaPromise = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        // Static, trusted DDL — no user input.
        await sql.query(stmt);
      }
    })().catch((err) => {
      // Allow a retry on the next cold start / request.
      _schemaPromise = null;
      throw err;
    });
  }
  return _schemaPromise;
}

/** Reset module state (used by tests only). */
export function _resetDbForTests(): void {
  _sql = undefined;
  _schemaPromise = null;
}
