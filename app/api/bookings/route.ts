import { NextRequest, NextResponse } from "next/server";
import { listBookings, cancelBooking } from "@/lib/bookings";
import { getAdminPassword } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Fail closed: in production with no ADMIN_PASSWORD, admin is disabled.
    const expected = getAdminPassword();
    if (expected === null) {
      return NextResponse.json(
        { error: "Admin not configured." },
        { status: 503 }
      );
    }
    if (body?.password !== expected) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    if (body.action === "cancel" && body.id) {
      const b = cancelBooking(String(body.id));
      if (!b) {
        return NextResponse.json(
          { error: "Booking not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ booking: b, bookings: listBookings() });
    }

    return NextResponse.json({ bookings: listBookings() });
  } catch {
    return NextResponse.json(
      { error: "Could not load bookings." },
      { status: 500 }
    );
  }
}
