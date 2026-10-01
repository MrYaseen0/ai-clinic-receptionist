"use client";

import { useEffect, useRef, useState } from "react";
import { DOCTORS } from "@/lib/doctors";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Slots {
  name?: string;
  phone?: string;
  doctor?: string;
  date?: string;
  time?: string;
  labTests?: string[];
  labDate?: string;
}

interface LabTestInfo {
  id: string;
  code: string;
  name: string;
  price: number;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Assalam-o-Alaikum! Welcome to Sehat Clinic.\nI can book doctor appointments and lab tests, and share doctor, fee, or timing info — in English or Roman Urdu.\nHow can I help you today?",
};

const QUICK = ["Our doctors", "Timings", "Fees", "Book appointment", "Lab test"];

const CONFIRM_WORDS = /^(yes|yeah|haan|han|ji|confirm|ok|okay|theek hai|done|kr do|kar do)\b/i;

function doctorName(id?: string): string {
  return DOCTORS.find((d) => d.id === id)?.name || id || "-";
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [slots, setSlots] = useState<Slots>({});
  const [bookingReady, setBookingReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [labTests, setLabTests] = useState<LabTestInfo[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/lab/tests")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setLabTests(d.items);
      })
      .catch(() => {});
  }, []);

  function labTestName(id: string): string {
    const t = labTests.find((x) => x.id === id);
    return t ? `${t.code} — ${t.name}` : id;
  }

  function labTotal(ids?: string[]): number {
    return (ids || []).reduce(
      (s, id) => s + (labTests.find((x) => x.id === id)?.price || 0),
      0
    );
  }

  const isLabBooking = !!slots.labTests && slots.labTests.length > 0;

  async function confirmLabBooking(currentSlots: Slots) {
    setLoading(true);
    try {
      const res = await fetch("/api/lab/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: currentSlots.name,
          patientPhone: currentSlots.phone,
          testIds: currentSlots.labTests,
          sampleDate: currentSlots.labDate,
          source: "chat",
          createdBy: "chat",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lab booking failed");
      setDone(data.order.id);
      const names = (currentSlots.labTests || []).map(labTestName).join(", ");
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Lab order confirmed!\n\nOrder ID: ${data.order.id}\nTests: ${names}\nTotal: Rs. ${data.order.total}\nSample date: ${data.order.sampleDate}\n\nPlease visit the lab on the sample date. Shukriya!`,
        },
      ]);
      setSlots({});
      setBookingReady(false);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, the lab booking could not be completed: " +
            (e instanceof Error ? e.message : "unknown error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open, loading]);

  async function confirmBooking(currentSlots: Slots) {
    setLoading(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentSlots.name,
          phone: currentSlots.phone,
          doctorId: currentSlots.doctor,
          date: currentSlots.date,
          time: currentSlots.time,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setDone(data.booking.id);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Appointment confirmed!\n\nBooking ID: ${data.booking.id}\nDoctor: ${data.booking.doctor}\nDate: ${data.booking.date}\nTime: ${data.booking.time}\nFee: Rs. ${data.booking.fee}\n\nPlease arrive 10 minutes early. See you soon!`,
        },
      ]);
      setSlots({});
      setBookingReady(false);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, the booking could not be completed: " +
            (e instanceof Error ? e.message : "unknown error"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Typed confirmation while a booking is pending
    if (bookingReady && CONFIRM_WORDS.test(trimmed)) {
      setMsgs((m) => [...m, { role: "user", content: trimmed }]);
      setInput("");
      if (slots.labTests && slots.labTests.length > 0) {
        await confirmLabBooking(slots);
      } else {
        await confirmBooking(slots);
      }
      return;
    }

    const nextMsgs: Msg[] = [...msgs, { role: "user", content: trimmed }];
    setMsgs(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs, slots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
      setSlots(data.slots || {});
      setBookingReady(data.bookingReady === true);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMsgs([GREETING]);
    setSlots({});
    setBookingReady(false);
    setDone(null);
  }

  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      const prefill = (e as CustomEvent).detail?.prefill as string | undefined;
      if (prefill) {
        // Defer so the panel renders first
        setTimeout(() => send(prefill), 350);
      }
    };
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, slots, bookingReady, loading]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat with AI receptionist"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Sehat Clinic Assistant</p>
              <p className="flex items-center gap-1.5 text-xs text-brand-100">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                Online — replies instantly
              </p>
            </div>
            <button
              onClick={resetChat}
              className="rounded-md px-2 py-1 text-xs text-brand-100 hover:bg-brand-700"
            >
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="chat-scroll flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-brand-600 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                        style={{ animationDelay: `${d * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Booking confirmation card */}
            {bookingReady && !loading && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm">
                {isLabBooking ? (
                  <>
                    <p className="mb-2 font-semibold text-brand-900">
                      Confirm your lab order
                    </p>
                    <dl className="space-y-1 text-slate-700">
                      <div className="flex justify-between gap-2"><dt>Tests</dt><dd className="text-right font-medium">{(slots.labTests || []).map(labTestName).join(", ")}</dd></div>
                      <div className="flex justify-between"><dt>Total</dt><dd className="font-medium">Rs. {labTotal(slots.labTests)}</dd></div>
                      <div className="flex justify-between"><dt>Sample date</dt><dd className="font-medium">{slots.labDate}</dd></div>
                      <div className="flex justify-between"><dt>Name</dt><dd className="font-medium">{slots.name}</dd></div>
                      <div className="flex justify-between"><dt>Phone</dt><dd className="font-medium">{slots.phone}</dd></div>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirmLabBooking(slots)}
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => send("cancel")}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-2 font-semibold text-brand-900">
                      Confirm your appointment
                    </p>
                    <dl className="space-y-1 text-slate-700">
                      <div className="flex justify-between"><dt>Doctor</dt><dd className="font-medium">{doctorName(slots.doctor)}</dd></div>
                      <div className="flex justify-between"><dt>Date</dt><dd className="font-medium">{slots.date}</dd></div>
                      <div className="flex justify-between"><dt>Time</dt><dd className="font-medium">{slots.time}</dd></div>
                      <div className="flex justify-between"><dt>Name</dt><dd className="font-medium">{slots.name}</dd></div>
                      <div className="flex justify-between"><dt>Phone</dt><dd className="font-medium">{slots.phone}</dd></div>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => confirmBooking(slots)}
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => send("cancel")}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {done && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm">
                <p className="text-slate-600">Your booking ID</p>
                <p className="font-mono text-lg font-bold text-emerald-800">{done}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type in English or Roman Urdu..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Send message"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
