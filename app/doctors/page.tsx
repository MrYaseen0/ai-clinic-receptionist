import type { Metadata } from "next";
import { DOCTORS } from "@/lib/doctors";

export const metadata: Metadata = {
  title: "Our Doctors — Sehat Clinic",
  description: "Meet the specialist doctors at Sehat Clinic with fees and timings.",
};

export default function DoctorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Our Doctors</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Six specialists, transparent fees, fixed timings. Click{" "}
        <span className="font-semibold">Book</span> and the AI receptionist will
        handle the rest — in English or Roman Urdu.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DOCTORS.map((d) => (
          <div
            key={d.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                {d.name.replace("Dr. ", "").charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{d.name}</h2>
                <p className="text-sm font-medium text-brand-700">{d.specialty}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Consultation fee</dt>
                <dd className="font-semibold text-slate-900">Rs. {d.fee}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Timings</dt>
                <dd className="font-medium text-slate-800">{d.timings}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Days</dt>
                <dd className="font-medium text-slate-800">{d.days}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Room</dt>
                <dd className="font-medium text-slate-800">{d.room}</dd>
              </div>
            </dl>
            <button
              data-open-chat
              data-prefill={`I want to book ${d.name}`}
              className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Book Appointment
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
