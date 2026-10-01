import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText, newQcId } from "@/lib/lab-store";
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
  return NextResponse.json({ items: db.qc });
}

export async function POST(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const name = cleanText(body?.name, 60);
    const paramName = cleanText(body?.paramName, 60);
    const unit = cleanText(body?.unit, 16);
    const mean = Number(body?.mean);
    const sd = Number(body?.sd);

    if (name.length < 3)
      return NextResponse.json({ error: "Name must be at least 3 characters." }, { status: 400 });
    if (paramName.length < 2)
      return NextResponse.json({ error: "Parameter name is required." }, { status: 400 });
    if (!Number.isFinite(mean))
      return NextResponse.json({ error: "Mean must be a number." }, { status: 400 });
    if (!Number.isFinite(sd) || sd <= 0)
      return NextResponse.json({ error: "SD must be a positive number." }, { status: 400 });

    const db = loadDb();
    const control = {
      id: newQcId(),
      name,
      paramName,
      unit,
      mean,
      sd,
      runs: [],
    };
    db.qc.push(control);
    saveDb();
    return NextResponse.json({ control }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create control." }, { status: 500 });
  }
}
