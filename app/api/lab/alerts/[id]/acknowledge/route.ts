import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  try {
    const body = await req.json().catch(() => ({}));
    const by = cleanText(body?.by, 40) || "pathologist";
    const db = await loadDb();
    const alert = db.alerts.find((a) => a.id === params.id);
    if (!alert)
      return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    alert.acknowledged = true;
    alert.acknowledgedBy = by;
    alert.acknowledgedAt = new Date().toISOString();
    await saveDb();
    return NextResponse.json({ alert });
  } catch {
    return NextResponse.json({ error: "Could not acknowledge alert." }, { status: 500 });
  }
}
