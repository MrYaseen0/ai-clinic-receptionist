import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  loadDb,
  saveDb,
  cleanText,
  newPaymentId,
  balanceDue,
} from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

const METHODS = ["cash", "card", "easypaisa", "jazzcash", "bank"];

/** Record a payment against an order/invoice. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  try {
    const body = await req.json();
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    const amount = Number(body?.amount);
    const method = typeof body?.method === "string" ? body.method : "";
    const receivedBy = cleanText(body?.receivedBy, 40) || "reception";

    if (!METHODS.includes(method))
      return NextResponse.json(
        { error: `Method must be one of: ${METHODS.join(", ")}.` },
        { status: 400 }
      );
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000)
      return NextResponse.json(
        { error: "Amount must be a positive number." },
        { status: 400 }
      );

    const db = await loadDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order)
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const due = balanceDue(order);
    if (amount > due)
      return NextResponse.json(
        { error: `Amount exceeds balance due (Rs. ${due}).` },
        { status: 400 }
      );

    const payment = {
      id: newPaymentId(),
      amount: Math.round(amount),
      method,
      date: new Date().toISOString(),
      receivedBy,
    };
    order.payments.push(payment);
    await saveDb();
    return NextResponse.json({ payment, due: balanceDue(order) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }
}
