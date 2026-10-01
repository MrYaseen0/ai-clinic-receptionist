import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Pathologist review: approve (→ approved) or reject (→ back to in_lab). */
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
    const action = body?.action;
    const note = cleanText(body?.note, 300);
    const reviewedBy = cleanText(body?.reviewedBy, 40) || "pathologist";

    if (action !== "approve" && action !== "reject")
      return NextResponse.json(
        { error: "action must be approve or reject." },
        { status: 400 }
      );
    if (action === "reject" && note.length < 3)
      return NextResponse.json(
        { error: "A rejection note is required." },
        { status: 400 }
      );

    const db = loadDb();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order)
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "under_review")
      return NextResponse.json(
        { error: "Only orders Under Review can be reviewed." },
        { status: 422 }
      );

    if (action === "approve") {
      const open = db.alerts.filter(
        (a) => a.orderId === order.id && !a.acknowledged
      );
      if (open.length > 0)
        return NextResponse.json(
          { error: "Acknowledge all critical alerts before approving." },
          { status: 422 }
        );
    }

    const to = action === "approve" ? "approved" : "in_lab";
    order.history.push({
      from: order.status,
      to,
      at: new Date().toISOString(),
      by: reviewedBy,
      ...(note ? { note } : {}),
    });
    order.status = to;
    order.reviewedBy = reviewedBy;
    order.reviewedAt = new Date().toISOString();
    if (note) order.reviewNote = note;
    saveDb();
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Could not submit review." }, { status: 500 });
  }
}
