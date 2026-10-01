import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, balanceDue } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  const db = loadDb();
  const today = new Date().toISOString().slice(0, 10);

  const todaysOrders = db.orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const revenueToday = db.orders
    .flatMap((o) => o.payments)
    .filter((p) => p.date.slice(0, 10) === today)
    .reduce((s, p) => s + p.amount, 0);
  const pending = db.orders.filter((o) =>
    ["registered", "sample_collected", "in_lab", "under_review"].includes(o.status)
  ).length;
  const unackedAlerts = db.alerts.filter((a) => !a.acknowledged).length;
  const outstanding = db.orders.reduce((s, o) => s + balanceDue(o), 0);

  // Recent activity: latest status events across orders
  const patientsById = new Map(db.patients.map((p) => [p.id, p]));
  const activity = db.orders
    .flatMap((o) =>
      o.history.map((h) => ({
        orderId: o.id,
        patientName: patientsById.get(o.patientId)?.name || "—",
        from: h.from,
        to: h.to,
        at: h.at,
        by: h.by,
      }))
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return NextResponse.json({
    todaysOrders: todaysOrders.length,
    revenueToday,
    pending,
    unackedAlerts,
    outstanding,
    totalPatients: db.patients.length,
    totalTests: db.tests.filter((t) => t.active).length,
    activity,
  });
}
