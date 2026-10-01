import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  isValidPhone,
  isValidDateStr,
  newPatientId,
  nextPatientSerial,
  nextOrderId,
  makeBarcode,
  type OrderStatus,
  type Priority,
  type LabOrder,
} from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

async function ok(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  return null;
}

const STATUSES: OrderStatus[] = [
  "registered",
  "sample_collected",
  "in_lab",
  "under_review",
  "approved",
  "report_released",
];
const PRIORITIES: Priority[] = ["routine", "urgent", "stat"];

export async function GET(req: NextRequest) {
  const lim = await ok(req);
  if (lim) return lim;
  const db = await loadDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const q = (searchParams.get("search") || "").toLowerCase().trim();

  const patientsById = new Map(db.patients.map((p) => [p.id, p]));
  let list = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (status && STATUSES.includes(status as OrderStatus))
    list = list.filter((o) => o.status === status);
  if (priority && PRIORITIES.includes(priority as Priority))
    list = list.filter((o) => o.priority === priority);
  if (q) {
    list = list.filter((o) => {
      const p = patientsById.get(o.patientId);
      return (
        o.id.toLowerCase().includes(q) ||
        (p?.name.toLowerCase().includes(q) ?? false) ||
        (p?.serial.toLowerCase().includes(q) ?? false)
      );
    });
  }
  const items = list.map((o) => ({
    ...o,
    patient: patientsById.get(o.patientId) || null,
    paid: o.payments.reduce((s, p) => s + p.amount, 0),
  }));
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: NextRequest) {
  const lim = await ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const db = await loadDb();

    // --- resolve patient: existing id OR inline name+phone ---
    let patientId = typeof body?.patientId === "string" ? body.patientId : "";
    let patient = db.patients.find((p) => p.id === patientId);
    if (!patient) {
      const patientName = cleanText(body?.patientName, 60);
      const patientPhone = cleanText(body?.patientPhone, 18);
      if (patientName.length < 2)
        return NextResponse.json(
          { error: "Patient name (2–60 chars) or a valid patientId is required." },
          { status: 400 }
        );
      if (!isValidPhone(patientPhone))
        return NextResponse.json(
          { error: "Enter a valid patient phone number." },
          { status: 400 }
        );
      // Reuse patient by phone to avoid duplicates (e.g. chat bookings).
      const digits = patientPhone.replace(/\D/g, "");
      const found =
        db.patients.find((p) => p.phone.replace(/\D/g, "") === digits) || undefined;
      patient = found;
      if (!patient) {
        const age = Number(body?.age);
        const gender = body?.gender;
        patient = {
          id: newPatientId(),
          serial: await nextPatientSerial(),
          name: patientName,
          phone: patientPhone,
          age: Number.isInteger(age) && age >= 0 && age <= 130 ? age : 30,
          gender: ["male", "female", "other"].includes(gender) ? gender : "other",
          createdAt: new Date().toISOString(),
        };
        db.patients.push(patient);
      }
      patientId = patient.id;
    }

    // --- tests ---
    const testIds: string[] = Array.isArray(body?.testIds)
      ? Array.from(new Set(body.testIds)).filter((x): x is string => typeof x === "string")
      : [];
    if (testIds.length === 0 || testIds.length > 20)
      return NextResponse.json(
        { error: "Select 1–20 tests." },
        { status: 400 }
      );
    const testsById = new Map(db.tests.map((t) => [t.id, t]));
    for (const tid of testIds) {
      const t = testsById.get(tid);
      if (!t || !t.active)
        return NextResponse.json(
          { error: "One or more selected tests are invalid." },
          { status: 400 }
        );
    }

    const referringDoctor = cleanText(body?.referringDoctor, 60);
    const priority: Priority = PRIORITIES.includes(body?.priority)
      ? body.priority
      : "routine";
    const sampleDate =
      typeof body?.sampleDate === "string" && isValidDateStr(body.sampleDate)
        ? body.sampleDate
        : new Date().toISOString().slice(0, 10);
    const source = body?.source === "chat" ? "chat" : "counter";

    const total = testIds.reduce((s, tid) => s + (testsById.get(tid)?.price || 0), 0);
    const id = await nextOrderId();
    const order: LabOrder = {
      id,
      patientId,
      testIds,
      referringDoctor,
      priority,
      status: "registered",
      sampleDate,
      barcode: makeBarcode(id),
      results: {},
      payments: [],
      total,
      history: [
        {
          from: null,
          to: "registered",
          at: new Date().toISOString(),
          by: cleanText(body?.createdBy, 40) || "reception",
        },
      ],
      source,
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    await saveDb();
    return NextResponse.json({ order, patient }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }
}
