import { CLINIC, DOCTORS } from "@/lib/doctors";

const SERVICES = [
  {
    title: "General OPD",
    desc: "Fever, flu, infections and everyday health concerns — diagnosed and treated fast.",
    icon: (
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    ),
  },
  {
    title: "Child Care",
    desc: "Vaccinations, growth tracking and gentle care for newborns to teens.",
    icon: (
      <path d="M12 21s-7-4.5-7-11a4 4 0 017-2.5A4 4 0 0119 10c0 6.5-7 11-7 11z" strokeLinejoin="round" />
    ),
  },
  {
    title: "Skin & Hair",
    desc: "Acne, allergies, pigmentation and hair-fall treatments by a specialist.",
    icon: (
      <path d="M12 3c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z" strokeLinejoin="round" />
    ),
  },
  {
    title: "Heart Care",
    desc: "Blood pressure, ECG screening and cardiac consultations.",
    icon: (
      <path d="M3 12h4l2-5 4 10 2-5h6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Dental",
    desc: "Cleaning, fillings, root canals and painless extractions.",
    icon: (
      <path d="M7 3h10l-1 7a3 3 0 01-3 3h-2a3 3 0 01-3-3L7 3zM7 3l-2 5m12-5l2 5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Bones & Joints",
    desc: "Back pain, fractures, arthritis and sports injury care.",
    icon: (
      <path d="M8 3v6a2 2 0 002 2h4a2 2 0 002-2V3M8 21v-6a2 2 0 012-2h4a2 2 0 012 2v6" strokeLinecap="round" />
    ),
  },
];

const STEPS = [
  {
    n: "1",
    title: "Chat with the AI",
    desc: "Tell the assistant which doctor you need, in English or Roman Urdu — no app, no phone call.",
  },
  {
    n: "2",
    title: "Confirm your slot",
    desc: "Pick a day and time, share your name and mobile number, and confirm.",
  },
  {
    n: "3",
    title: "Visit the clinic",
    desc: "Show your booking ID at the counter and walk straight in. No waiting lines.",
  },
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AI Clinic Receptionist",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: {
      "@type": "Person",
      name: "Yaseen Ahmad",
      url: "https://yaseenahmadexe.vercel.app",
    },
    url: "https://ai-clinic-receptionist-gold.vercel.app",
    description:
      "Free open-source AI receptionist for clinics. Bilingual chatbot books appointments 24/7 in English and Roman Urdu.",
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* HERO */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              AI-Powered Clinic Demo
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Meet your clinic&apos;s new receptionist.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-slate-600">
              {CLINIC.name}&apos;s AI assistant books appointments, answers
              questions about doctors, fees and timings — in{" "}
              <span className="font-semibold text-slate-800">English or Roman Urdu</span>,
              24/7. No missed calls, no waiting lines.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                data-open-chat
                className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700"
              >
                Chat with AI Receptionist
              </button>
              <a
                href="/doctors"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View Doctors
              </a>
            </div>
            <div className="mt-8 flex gap-8 text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-900">6</p>
                <p className="text-slate-500">Specialist doctors</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">2</p>
                <p className="text-slate-500">Languages (EN + UR)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">24/7</p>
                <p className="text-slate-500">Booking available</p>
              </div>
            </div>
          </div>

          {/* Booking card mock */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Sehat Clinic Assistant</p>
                  <p className="text-xs text-slate-500">Typically replies instantly</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  Assalam-o-Alaikum! Which doctor would you like to see?
                </div>
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-white">
                  Skin specialist, kal sham
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  Dr. Bilal Hussain (Dermatologist) — Rs. 2000, Mon/Wed/Fri 5–9 PM. What time suits you?
                </div>
              </div>
              <button
                data-open-chat
                data-prefill="I want to book an appointment"
                className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Try the live demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">Our Services</h2>
        <p className="mt-2 text-slate-600">Everything a family clinic should offer, under one roof.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {s.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DOCTORS PREVIEW */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Meet the Doctors</h2>
              <p className="mt-2 text-slate-600">Qualified specialists, transparent fees.</p>
            </div>
            <a href="/doctors" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
              View all 6
            </a>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DOCTORS.slice(0, 3).map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                  {d.name.replace("Dr. ", "").charAt(0)}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{d.name}</h3>
                <p className="text-sm text-brand-700">{d.specialty}</p>
                <p className="mt-2 text-sm text-slate-600">{d.timings}</p>
                <p className="text-sm text-slate-600">{d.days}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Rs. {d.fee}</span>
                  <button
                    data-open-chat
                    data-prefill={`I want to book ${d.name}`}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
        <p className="mt-2 text-slate-600">From chat to confirmed appointment in under a minute.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-200 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TIMINGS / LOCATION */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-semibold">Timings</h3>
            <p className="mt-2 text-brand-100">{CLINIC.hours}</p>
            <p className="text-brand-100">{CLINIC.closedNote}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Visit us</h3>
            <p className="mt-2 text-brand-100">{CLINIC.address}</p>
            <p className="text-brand-100">Phone: {CLINIC.phone}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Book instantly</h3>
            <p className="mt-2 text-brand-100">The AI receptionist never sleeps.</p>
            <button
              data-open-chat
              className="mt-3 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-50"
            >
              Start chatting
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
