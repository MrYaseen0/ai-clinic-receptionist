import { NextRequest, NextResponse } from "next/server";
import { getReply, currentMode, type ChatMessage, type BookingSlots } from "@/lib/ai";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`chat:${ip}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const messages = (body.messages || []) as ChatMessage[];
    const slots = (body.slots || {}) as BookingSlots;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const result = await getReply(messages, slots);
    return NextResponse.json({ ...result, mode: currentMode() });
  } catch {
    return NextResponse.json(
      { error: "Chat service unavailable. Please try again." },
      { status: 500 }
    );
  }
}
