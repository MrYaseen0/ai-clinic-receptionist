import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  isValidPhone,
  newPatientId,
  nextPatientSerial,
} from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

function ok(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  return null;
}

export async function GET(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("search") || "").toLowerCase().trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("page_size") || "10", 10) || 10)
  );

  let list = [...db.patients].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        p.serial.toLowerCase().includes(q)
    );
  }
  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({ items, total, page, page_size: pageSize });
}

export async function POST(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const name = cleanText(body?.name, 60);
    const phone = cleanText(body?.phone, 18);
    const age = Number(body?.age);
    const gender = body?.gender;
    const address = cleanText(body?.address, 120);

    if (name.length < 2)
      return NextResponse.json(
        { error: "Name must be 2–60 characters." },
        { status: 400 }
      );
    if (!isValidPhone(phone))
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 }
      );
    if (!Number.isInteger(age) || age < 0 || age > 130)
      return NextResponse.json(
        { error: "Age must be 0–130." },
        { status: 400 }
      );
    if (!["male", "female", "other"].includes(gender))
      return NextResponse.json(
        { error: "Gender must be male, female or other." },
        { status: 400 }
      );

    const db = loadDb();
    const patient = {
      id: newPatientId(),
      serial: nextPatientSerial(),
      name,
      phone,
      age,
      gender,
      ...(address ? { address } : {}),
      createdAt: new Date().toISOString(),
    };
    db.patients.push(patient);
    saveDb();
    return NextResponse.json({ patient }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not register patient." }, { status: 500 });
  }
}
