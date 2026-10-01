import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, latestResults } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Pathologist review queue: under_review orders + their results & open alerts. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  const db = await loadDb();
  const testsById = Object.fromEntries(db.tests.map((t) => [t.id, t]));
  const patientsById = new Map(db.patients.map((p) => [p.id, p]));
  const items = db.orders
    .filter((o) => o.status === "under_review")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const latest = latestResults(o);
      const flagged = Object.entries(latest)
        .filter(([, e]) => e.flag !== "N")
        .map(([key, e]) => {
          const [testId, paramKey] = key.split(":");
          const t = testsById[testId];
          const p = t?.params.find((x) => x.key === paramKey);
          return {
            testCode: t?.code,
            paramName: p?.name,
            unit: p?.unit,
            value: e.value,
            flag: e.flag,
          };
        });
      return {
        order: o,
        patient: patientsById.get(o.patientId) || null,
        tests: o.testIds.map((tid) => testsById[tid]).filter(Boolean),
        flagged,
        openAlerts: db.alerts.filter(
          (a) => a.orderId === o.id && !a.acknowledged
        ),
      };
    });
  return NextResponse.json({ items });
}
