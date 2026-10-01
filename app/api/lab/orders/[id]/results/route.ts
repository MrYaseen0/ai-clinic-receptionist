import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  flagValue,
  newAlertId,
  type ResultEntry,
} from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Technician result entry — auto H/L/N flags, critical values raise alerts. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  try {
    const body = await req.json();
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    const enteredBy = cleanText(body?.enteredBy, 40) || "technician";

    if (entries.length === 0 || entries.length > 60)
      return NextResponse.json(
        { error: "Provide 1–60 result entries." },
        { status: 400 }
      );

    const db = loadDb();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order)
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "in_lab")
      return NextResponse.json(
        { error: "Results can only be entered while the order is In Lab." },
        { status: 422 }
      );

    const testsById = new Map(db.tests.map((t) => [t.id, t]));
    const now = new Date().toISOString();
    const saved: ResultEntry[] = [];
    const newAlerts: string[] = [];

    for (const e of entries) {
      const testId = typeof e?.testId === "string" ? e.testId : "";
      const paramKey = typeof e?.paramKey === "string" ? e.paramKey : "";
      const value = Number(e?.value);
      const test = testsById.get(testId);
      const param = test?.params.find((p) => p.key === paramKey);
      if (!test || !param || !order.testIds.includes(testId))
        return NextResponse.json(
          { error: "Invalid testId/paramKey in entries." },
          { status: 400 }
        );
      if (!Number.isFinite(value) || value < 0 || value > 100000)
        return NextResponse.json(
          { error: `Value for ${param.name} must be 0–100000.` },
          { status: 400 }
        );
      const flag = flagValue(param, value);
      const entry: ResultEntry = {
        paramKey,
        value,
        flag,
        enteredAt: now,
        enteredBy,
      };
      const bucket = order.results[testId] || [];
      const ix = bucket.findIndex((x) => x.paramKey === paramKey);
      if (ix >= 0) bucket[ix] = entry;
      else bucket.push(entry);
      order.results[testId] = bucket;
      saved.push(entry);

      if (flag === "CL" || flag === "CH") {
        const already = db.alerts.some(
          (a) =>
            a.orderId === order.id &&
            a.paramName === `${test.code} — ${param.name}` &&
            !a.acknowledged
        );
        if (!already) {
          const alert = {
            id: newAlertId(),
            orderId: order.id,
            paramName: `${test.code} — ${param.name}`,
            value,
            unit: param.unit,
            level: (flag === "CL" ? "critical_low" : "critical_high") as
              | "critical_low"
              | "critical_high",
            acknowledged: false,
            createdAt: now,
          };
          db.alerts.push(alert);
          newAlerts.push(alert.id);
        }
      }
    }

    saveDb();
    return NextResponse.json({ saved, criticalAlerts: newAlerts });
  } catch {
    return NextResponse.json({ error: "Could not save results." }, { status: 500 });
  }
}
