import fs from "fs";
import path from "path";
import { getSql, dbAvailable, ensureSchema } from "./db";

export interface Booking {
  id: string;
  name: string;
  phone: string;
  doctor: string; // doctor name (denormalized for display)
  doctorId: string;
  specialty: string;
  fee: number;
  date: string;
  time: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

const DATA_FILE = path.join(process.cwd(), "data", "bookings.json");

let cache: Booking[] | null = null;

function loadFile(): Booking[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw) as Booking[];
    }
  } catch {
    // fall through to empty
  }
  return [];
}

function saveFile(rows: Booking[]): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), "utf-8");
  } catch {
    // Demo mode: persistence is best-effort (e.g. read-only FS on serverless)
  }
}

type BookingRow = {
  id: string;
  name: string;
  phone: string;
  doctor: string;
  doctor_id: string;
  specialty: string;
  fee: number | string;
  date: string;
  time: string;
  status: string;
  created_at: string | Date;
};

function rowToBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    doctor: r.doctor,
    doctorId: r.doctor_id,
    specialty: r.specialty,
    fee: Number(r.fee),
    date: r.date,
    time: r.time,
    status: r.status === "cancelled" ? "cancelled" : "confirmed",
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

async function loadFromDb(): Promise<Booking[]> {
  const sql = getSql()!;
  const rows = (await sql`
    SELECT id, name, phone, doctor, doctor_id, specialty, fee, date, time, status, created_at
    FROM bookings
  `) as unknown as BookingRow[];
  return rows.map(rowToBooking);
}

async function saveToDb(rows: Booking[]): Promise<void> {
  const sql = getSql()!;
  // Full replace inside one transaction: the store is tiny and this keeps
  // the in-memory cache and the database trivially consistent.
  await sql.transaction([
    sql`DELETE FROM bookings`,
    ...rows.map(
      (b) => sql`
        INSERT INTO bookings (id, name, phone, doctor, doctor_id, specialty, fee, date, time, status, created_at)
        VALUES (${b.id}, ${b.name}, ${b.phone}, ${b.doctor}, ${b.doctorId}, ${b.specialty}, ${b.fee}, ${b.date}, ${b.time}, ${b.status}, ${b.createdAt}::timestamptz)
      `
    ),
  ]);
}

async function load(): Promise<Booking[]> {
  if (cache) return cache;
  if (dbAvailable()) {
    await ensureSchema();
    cache = await loadFromDb();
  } else {
    cache = loadFile();
  }
  return cache;
}

async function save(): Promise<void> {
  if (!cache) return;
  if (dbAvailable()) {
    await saveToDb(cache);
  } else {
    saveFile(cache);
  }
}

/** Reset the in-memory cache (used by tests/seed flows). */
export function resetBookingCache(): void {
  cache = null;
}

function makeId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SC-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export async function listBookings(): Promise<Booking[]> {
  return [...(await load())].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function createBooking(input: {
  name: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  fee: number;
  date: string;
  time: string;
}): Promise<Booking> {
  const booking: Booking = {
    id: makeId(),
    name: input.name,
    phone: input.phone,
    doctor: input.doctorName,
    doctorId: input.doctorId,
    specialty: input.specialty,
    fee: input.fee,
    date: input.date,
    time: input.time,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  (await load()).push(booking);
  await save();
  return booking;
}

export async function cancelBooking(id: string): Promise<Booking | undefined> {
  const b = (await load()).find((x) => x.id === id);
  if (b) {
    b.status = "cancelled";
    await save();
  }
  return b;
}
