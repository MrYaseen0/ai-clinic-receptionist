import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb } from "@/lib/lab-store";
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

/** Simplified Westgard evaluation for one new run. */
function evaluate(
  mean: number,
  sd: number,
  value: number,
  prevZ: number | null
): string | undefined {
  const z = (value - mean) / sd;
  if (Math.abs(z) > 3) return "1_3s";
  if (Math.abs(z) > 2) {
    if (prevZ !== null && Math.abs(prevZ) > 2 && Math.sign(prevZ) === Math.sign(z))
      return "2_2s";
    return "1_2s warn";
  }
  if (prevZ !== null && Math.abs(z - prevZ) > 4) return "R_4s";
  return undefined;
}

/** Log a QC run; Westgard violations are evaluated automatically. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const value = Number(body?.value);
    const date =
      typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : new Date().toISOString().slice(0, 10);
    if (!Number.isFinite(value))
      return NextResponse.json({ error: "Value must be a number." }, { status: 400 });

    const db = loadDb();
    const control = db.qc.find((c) => c.id === params.id);
    if (!control)
      return NextResponse.json({ error: "Control not found." }, { status: 404 });

    const prev = control.runs[control.runs.length - 1];
    const prevZ = prev ? (prev.value - control.mean) / control.sd : null;
    const violation = evaluate(control.mean, control.sd, value, prevZ);
    const run = { date, value, ...(violation ? { violation } : {}) };
    control.runs.push(run);
    saveDb();
    return NextResponse.json({ run }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not log run." }, { status: 500 });
  }
}

/** Chart data: points + mean/±1/2/3 SD lines for the Levey-Jennings chart. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  const control = db.qc.find((c) => c.id === params.id);
  if (!control)
    return NextResponse.json({ error: "Control not found." }, { status: 404 });
  const { mean, sd } = control;
  return NextResponse.json({
    control: {
      id: control.id,
      name: control.name,
      paramName: control.paramName,
      unit: control.unit,
      mean,
      sd,
    },
    points: control.runs.map((r, i) => ({
      i,
      date: r.date,
      value: r.value,
      z: Math.round(((r.value - mean) / sd) * 100) / 100,
      violation: r.violation || null,
    })),
    lines: {
      mean,
      plus1: mean + sd,
      minus1: mean - sd,
      plus2: mean + 2 * sd,
      minus2: mean - 2 * sd,
      plus3: mean + 3 * sd,
      minus3: mean - 3 * sd,
    },
  });
}
