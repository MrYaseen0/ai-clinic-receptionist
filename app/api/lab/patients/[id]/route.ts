import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText, isValidPhone } from "@/lib/lab-store";
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = await ok(req);
  if (lim) return lim;
  const db = await loadDb();
  const patient = db.patients.find((p) => p.id === params.id);
  if (!patient)
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  const orders = db.orders
    .filter((o) => o.patientId === patient.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ patient, orders });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = await ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const db = await loadDb();
    const patient = db.patients.find((p) => p.id === params.id);
    if (!patient)
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });

    if (body.name !== undefined) {
      const name = cleanText(body.name, 60);
      if (name.length < 2)
        return NextResponse.json(
          { error: "Name must be 2–60 characters." },
          { status: 400 }
        );
      patient.name = name;
    }
    if (body.phone !== undefined) {
      const phone = cleanText(body.phone, 18);
      if (!isValidPhone(phone))
        return NextResponse.json(
          { error: "Enter a valid phone number." },
          { status: 400 }
        );
      patient.phone = phone;
    }
    if (body.age !== undefined) {
      const age = Number(body.age);
      if (!Number.isInteger(age) || age < 0 || age > 130)
        return NextResponse.json({ error: "Age must be 0–130." }, { status: 400 });
      patient.age = age;
    }
    if (body.gender !== undefined) {
      if (!["male", "female", "other"].includes(body.gender))
        return NextResponse.json(
          { error: "Gender must be male, female or other." },
          { status: 400 }
        );
      patient.gender = body.gender;
    }
    if (body.address !== undefined) patient.address = cleanText(body.address, 120);

    await saveDb();
    return NextResponse.json({ patient });
  } catch {
    return NextResponse.json({ error: "Could not update patient." }, { status: 500 });
  }
}
