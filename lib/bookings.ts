import fs from "fs";
import path from "path";

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

function load(): Booking[] {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      cache = JSON.parse(raw) as Booking[];
      return cache;
    }
  } catch {
    // fall through to empty
  }
  cache = [];
  return cache;
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Demo mode: persistence is best-effort (e.g. read-only FS on serverless)
  }
}

function makeId(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SC-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function listBookings(): Booking[] {
  return [...load()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createBooking(input: {
  name: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  fee: number;
  date: string;
  time: string;
}): Booking {
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
  load().push(booking);
  save();
  return booking;
}

export function cancelBooking(id: string): Booking | undefined {
  const b = load().find((x) => x.id === id);
  if (b) {
    b.status = "cancelled";
    save();
  }
  return b;
}
