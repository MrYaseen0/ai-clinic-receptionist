import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  newTestId,
  type LabParam,
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

function validParam(p: unknown): p is LabParam {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.key === "string" &&
    /^[a-z0-9_]{1,24}$/.test(o.key) &&
    typeof o.name === "string" &&
    o.name.trim().length >= 2 &&
    typeof o.unit === "string" &&
    typeof o.refLow === "number" &&
    typeof o.refHigh === "number" &&
    o.refLow <= o.refHigh &&
    (o.criticalLow === undefined || typeof o.criticalLow === "number") &&
    (o.criticalHigh === undefined || typeof o.criticalHigh === "number")
  );
}

function sanitizeParams(raw: unknown): LabParam[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) return null;
  const keys = new Set<string>();
  const out: LabParam[] = [];
  for (const p of raw) {
    if (!validParam(p)) return null;
    const key = p.key.toLowerCase();
    if (keys.has(key)) return null;
    keys.add(key);
    out.push({
      key,
      name: cleanText(p.name, 60),
      unit: cleanText(p.unit, 16),
      refLow: p.refLow,
      refHigh: p.refHigh,
      ...(p.criticalLow !== undefined ? { criticalLow: p.criticalLow } : {}),
      ...(p.criticalHigh !== undefined ? { criticalHigh: p.criticalHigh } : {}),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const q = (searchParams.get("search") || "").toLowerCase().trim();
  let list = db.tests.filter((t) => t.active);
  if (category) list = list.filter((t) => t.category === category);
  if (q)
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  const categories = Array.from(new Set(db.tests.map((t) => t.category))).sort();
  return NextResponse.json({ items: list, categories });
}

export async function POST(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const code = cleanText(body?.code, 12).toUpperCase();
    const name = cleanText(body?.name, 80);
    const category = cleanText(body?.category, 40);
    const price = Number(body?.price);
    const sampleType = cleanText(body?.sampleType, 40);
    const turnaroundHrs = Number(body?.turnaroundHrs);
    const params = sanitizeParams(body?.params);

    if (!/^[A-Z0-9]{2,12}$/.test(code))
      return NextResponse.json(
        { error: "Code must be 2–12 uppercase letters/digits." },
        { status: 400 }
      );
    if (name.length < 3)
      return NextResponse.json(
        { error: "Name must be at least 3 characters." },
        { status: 400 }
      );
    if (!category)
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    if (!Number.isFinite(price) || price < 0 || price > 1000000)
      return NextResponse.json({ error: "Price must be 0–1,000,000." }, { status: 400 });
    if (!params)
      return NextResponse.json(
        { error: "Provide 1–30 valid parameters with unique keys." },
        { status: 400 }
      );
    if (!Number.isFinite(turnaroundHrs) || turnaroundHrs < 1 || turnaroundHrs > 720)
      return NextResponse.json(
        { error: "Turnaround must be 1–720 hours." },
        { status: 400 }
      );

    const db = loadDb();
    if (db.tests.some((t) => t.code === code))
      return NextResponse.json(
        { error: "A test with this code already exists." },
        { status: 400 }
      );
    const t = {
      id: newTestId(),
      code,
      name,
      category,
      price: Math.round(price),
      sampleType: sampleType || "Serum",
      turnaroundHrs: Math.round(turnaroundHrs),
      params,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.tests.push(t);
    saveDb();
    return NextResponse.json({ test: t }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create test." }, { status: 500 });
  }
}
