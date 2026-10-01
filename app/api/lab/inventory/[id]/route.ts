import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, saveDb, cleanText } from "@/lib/lab-store";
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  try {
    const body = await req.json();
    const db = loadDb();
    const item = db.inventory.find((x) => x.id === params.id);
    if (!item)
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    if (body.name !== undefined) {
      const n = cleanText(body.name, 80);
      if (n.length < 3)
        return NextResponse.json({ error: "Name must be at least 3 characters." }, { status: 400 });
      item.name = n;
    }
    if (body.qty !== undefined) {
      const q = Number(body.qty);
      if (!Number.isFinite(q) || q < 0 || q > 1000000)
        return NextResponse.json({ error: "Qty must be 0–1,000,000." }, { status: 400 });
      item.qty = Math.floor(q);
    }
    if (body.minStock !== undefined) {
      const m = Number(body.minStock);
      if (!Number.isFinite(m) || m < 0 || m > 1000000)
        return NextResponse.json({ error: "Min stock must be 0–1,000,000." }, { status: 400 });
      item.minStock = Math.floor(m);
    }
    if (body.lot !== undefined) item.lot = cleanText(body.lot, 30);
    if (body.expiry !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expiry))
        return NextResponse.json({ error: "Expiry must be YYYY-MM-DD." }, { status: 400 });
      item.expiry = body.expiry;
    }
    if (body.supplier !== undefined) item.supplier = cleanText(body.supplier, 60);
    saveDb();
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Could not update item." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lim = ok(req);
  if (lim) return lim;
  const db = loadDb();
  const ix = db.inventory.findIndex((x) => x.id === params.id);
  if (ix < 0) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  db.inventory.splice(ix, 1);
  saveDb();
  return NextResponse.json({ ok: true });
}
