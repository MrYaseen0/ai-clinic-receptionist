import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, pendingParams } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Technician work queue: orders in sample_collected / in_lab with pending params. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  const db = await loadDb();
  const testsById = Object.fromEntries(db.tests.map((t) => [t.id, t]));
  const patientsById = new Map(db.patients.map((p) => [p.id, p]));
  const queue = db.orders
    .filter((o) => o.status === "sample_collected" || o.status === "in_lab")
    .sort((a, b) => {
      const pw = { stat: 0, urgent: 1, routine: 2 } as const;
      return pw[a.priority] - pw[b.priority] || a.createdAt.localeCompare(b.createdAt);
    })
    .map((o) => ({
      order: o,
      patient: patientsById.get(o.patientId) || null,
      tests: o.testIds.map((tid) => testsById[tid]).filter(Boolean),
      pendingCount: pendingParams(o, testsById).length,
      resultsCount: Object.values(o.results).flat().length,
    }));
  return NextResponse.json({ items: queue });
}
