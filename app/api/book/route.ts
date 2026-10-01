import { NextRequest, NextResponse } from "next/server";
import { createBooking } from "@/lib/bookings";
import { DOCTORS } from "@/lib/doctors";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Strip HTML tags so stored values can never carry markup/script. */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`book:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { doctorId, date, time } = body || {};

    // --- name: 2–60 chars, no HTML ---
    const name =
      typeof body?.name === "string" ? stripTags(body.name).trim() : "";
    if (name.length < 2 || name.length > 60) {
      return bad("Please enter a valid name (2–60 characters).");
    }

    // --- phone: digits, +, spaces, dashes; 7–16 chars; at least 7 digits ---
    const rawPhone =
      typeof body?.phone === "string" ? stripTags(body.phone).trim() : "";
    if (
      rawPhone.length < 7 ||
      rawPhone.length > 16 ||
      !/^[+\d][\d\s\-]*$/.test(rawPhone)
    ) {
      return bad(
        "Please enter a valid phone number (digits, spaces, dashes, optional leading +; 7–16 characters)."
      );
    }
    const digitsOnly = rawPhone.replace(/\D/g, "");
    if (digitsOnly.length < 7) {
      return bad("Please enter a valid phone number (at least 7 digits).");
    }
    const phone = (/^\+/.test(rawPhone) ? "+" : "") + digitsOnly;

    // --- doctor: must exist ---
    const doctor = DOCTORS.find((d) => d.id === doctorId);
    if (!doctor) {
      return bad("Please choose a valid doctor.");
    }

    // --- date: valid YYYY-MM-DD, today or future ---
    const dateStr = typeof date === "string" ? date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return bad("Date must be in YYYY-MM-DD format.");
    }
    const [y, m, dd] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, dd);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== m - 1 ||
      dt.getDate() !== dd
    ) {
      return bad("Please enter a real calendar date.");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dt < today) {
      return bad("Appointment date cannot be in the past.");
    }

    // --- time: allowed 12-hour slot format ("5:00 PM") ---
    const timeStr = typeof time === "string" ? stripTags(time).trim() : "";
    if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(timeStr)) {
      return bad("Please choose a valid time slot (e.g. 5:00 PM).");
    }

    const booking = await createBooking({
      name,
      phone,
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      fee: doctor.fee,
      date: dateStr,
      time: timeStr,
    });

    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json(
      { error: "Could not create booking. Please try again." },
      { status: 500 }
    );
  }
}
