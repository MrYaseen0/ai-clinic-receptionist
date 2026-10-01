import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Seed the lab demo data (only works on an empty store). */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab-seed:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const seeded = seedIfEmpty();
  return NextResponse.json({ seeded });
}
