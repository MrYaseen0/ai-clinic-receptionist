import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  const db = loadDb();
  const order = db.orders.find((o) => o.id === params.id);
  if (!order)
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const patient = db.patients.find((p) => p.id === order.patientId) || null;
  const tests = order.testIds
    .map((tid) => db.tests.find((t) => t.id === tid))
    .filter(Boolean);
  const alerts = db.alerts.filter((a) => a.orderId === order.id);
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  return NextResponse.json({ order, patient, tests, alerts, paid });
}
