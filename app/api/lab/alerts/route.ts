import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb } from "@/lib/lab-store";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab:${ip}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();
  const db = await loadDb();
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("acknowledged"); // "true" | "false" | null
  let alerts = [...db.alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filter === "true") alerts = alerts.filter((a) => a.acknowledged);
  if (filter === "false") alerts = alerts.filter((a) => !a.acknowledged);
  return NextResponse.json({ items: alerts, total: alerts.length });
}
