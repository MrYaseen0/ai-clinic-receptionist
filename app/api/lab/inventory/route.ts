import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText, newItemId } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

function ok(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  seedIfEmpty();
  return null;
}

export async function GET(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  return NextResponse.json({ items: db.inventory });
}

export async function POST(req: NextRequest) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const name = cleanText(body?.name, 80);
    const category = body?.category;
    const lot = cleanText(body?.lot, 30);
    const qty = Number(body?.qty);
    const unit = cleanText(body?.unit, 16);
    const minStock = Number(body?.minStock);
    const expiry = typeof body?.expiry === "string" ? body.expiry : "";
    const supplier = cleanText(body?.supplier, 60);

    if (name.length < 3)
      return NextResponse.json({ error: "Name must be at least 3 characters." }, { status: 400 });
    if (!["reagent", "consumable"].includes(category))
      return NextResponse.json({ error: "Category must be reagent or consumable." }, { status: 400 });
    if (!Number.isFinite(qty) || qty < 0 || qty > 1000000)
      return NextResponse.json({ error: "Qty must be 0–1,000,000." }, { status: 400 });
    if (!Number.isFinite(minStock) || minStock < 0 || minStock > 1000000)
      return NextResponse.json({ error: "Min stock must be 0–1,000,000." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry))
      return NextResponse.json({ error: "Expiry must be YYYY-MM-DD." }, { status: 400 });

    const db = loadDb();
    const item = {
      id: newItemId(),
      name,
      category,
      lot,
      qty: Math.floor(qty),
      unit: unit || "units",
      minStock: Math.floor(minStock),
      expiry,
      supplier,
    };
    db.inventory.push(item);
    saveDb();
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not add item." }, { status: 500 });
  }
}
