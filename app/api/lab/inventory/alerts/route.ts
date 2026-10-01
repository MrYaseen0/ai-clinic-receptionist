import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Inventory alert buckets: expired, expiring within 30 days, low stock. */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  const db = await loadDb();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30s = in30.toISOString().slice(0, 10);

  const expired = db.inventory.filter((i) => i.expiry < today);
  const expiringSoon = db.inventory.filter(
    (i) => i.expiry >= today && i.expiry <= in30s
  );
  const lowStock = db.inventory.filter((i) => i.qty <= i.minStock);
  return NextResponse.json({ expired, expiringSoon, lowStock });
}
