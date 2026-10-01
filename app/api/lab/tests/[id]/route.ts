import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText } from "@/lib/lab-store";
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const db = loadDb();
    const t = db.tests.find((x) => x.id === params.id);
    if (!t) return NextResponse.json({ error: "Test not found." }, { status: 404 });

    if (body.name !== undefined) {
      const name = cleanText(body.name, 80);
      if (name.length < 3)
        return NextResponse.json({ error: "Name must be at least 3 characters." }, { status: 400 });
      t.name = name;
    }
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0 || price > 1000000)
        return NextResponse.json({ error: "Price must be 0–1,000,000." }, { status: 400 });
      t.price = Math.round(price);
    }
    if (body.category !== undefined) {
      const c = cleanText(body.category, 40);
      if (!c) return NextResponse.json({ error: "Category is required." }, { status: 400 });
      t.category = c;
    }
    if (body.sampleType !== undefined) t.sampleType = cleanText(body.sampleType, 40) || "Serum";
    if (body.turnaroundHrs !== undefined) {
      const h = Number(body.turnaroundHrs);
      if (!Number.isFinite(h) || h < 1 || h > 720)
        return NextResponse.json({ error: "Turnaround must be 1–720 hours." }, { status: 400 });
      t.turnaroundHrs = Math.round(h);
    }
    saveDb();
    return NextResponse.json({ test: t });
  } catch {
    return NextResponse.json({ error: "Could not update test." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  const t = db.tests.find((x) => x.id === params.id);
  if (!t) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  // Soft-delete: keep historical orders intact.
  t.active = false;
  saveDb();
  return NextResponse.json({ ok: true });
}
