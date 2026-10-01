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

  // Revenue trend: last 14 days from recorded payments
  const days: Array<{ date: string; revenue: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const revenue = db.orders
      .flatMap((o) => o.payments)
      .filter((p) => p.date.slice(0, 10) === key)
      .reduce((s, p) => s + p.amount, 0);
    days.push({ date: key, revenue });
  }

  // Test volumes per category (all time)
  const testsById = new Map(db.tests.map((t) => [t.id, t]));
  const byCategory: Record<string, number> = {};
  const byTest: Record<string, { name: string; code: string; count: number; revenue: number }> = {};
  for (const o of db.orders) {
    for (const tid of o.testIds) {
      const t = testsById.get(tid);
      if (!t) continue;
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      const e = byTest[tid] || { name: t.name, code: t.code, count: 0, revenue: 0 };
      e.count += 1;
      e.revenue += t.price;
      byTest[tid] = e;
    }
  }

  const ordersByStatus: Record<string, number> = {};
  for (const o of db.orders) ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

  const totalBilled = db.orders.reduce((s, o) => s + o.total, 0);
  const totalCollected = db.orders
    .flatMap((o) => o.payments)
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = db.orders.reduce((s, o) => s + balanceDue(o), 0);

  return NextResponse.json({
    revenueByDay: days,
    testsByCategory: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topTests: Object.values(byTest)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    ordersByStatus,
    totals: {
      orders: db.orders.length,
      billed: totalBilled,
      collected: totalCollected,
      outstanding,
    },
  });
}
