import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  canTransition,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Server-enforced workflow state machine. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  try {
    const body = await req.json();
    const to = body?.to as OrderStatus;
    const by = cleanText(body?.by, 40) || "staff";
    const note = cleanText(body?.note, 200);

    if (!ORDER_STATUSES.includes(to))
      return NextResponse.json({ error: "Invalid target status." }, { status: 400 });

    const db = await loadDb();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order)
      return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (!canTransition(order.status, to))
      return NextResponse.json(
        { error: `Cannot move order from ${order.status} to ${to}.` },
        { status: 422 }
      );

    // Guard: can't send to review with zero results; can't approve with unacked criticals.
    if (to === "under_review") {
      const n = Object.values(order.results).flat().length;
      if (n === 0)
        return NextResponse.json(
          { error: "Enter at least one result before sending to review." },
          { status: 422 }
        );
    }
    if (to === "approved") {
      const open = db.alerts.filter(
        (a) => a.orderId === order.id && !a.acknowledged
      );
      if (open.length > 0)
        return NextResponse.json(
          { error: "Acknowledge all critical alerts before approving." },
          { status: 422 }
        );
    }

    order.history.push({
      from: order.status,
      to,
      at: new Date().toISOString(),
      by,
      ...(note ? { note } : {}),
    });
    order.status = to;
    await saveDb();
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Could not update status." }, { status: 500 });
  }
}
