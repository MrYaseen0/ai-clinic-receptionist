import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, balanceDue, amountPaid } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Invoice list — every lab order is an invoice. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  const db = loadDb();
  const { searchParams } = new URL(req.url);
  const unpaidOnly = searchParams.get("unpaid") === "true";
  const patientsById = new Map(db.patients.map((p) => [p.id, p]));
  let items = db.orders
    .map((o) => ({
      order: o,
      patient: patientsById.get(o.patientId) || null,
      paid: amountPaid(o),
      due: balanceDue(o),
    }))
    .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  if (unpaidOnly) items = items.filter((i) => i.due > 0);
  const totalDue = items.reduce((s, i) => s + i.due, 0);
  return NextResponse.json({ items, totalDue });
}
