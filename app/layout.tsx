import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import MobileNav from "@/components/MobileNav";
import { CLINIC } from "@/lib/doctors";

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-clinic-receptionist-gold.vercel.app"),
  verification: {
    google: "F2uI67yfxNTY9YSi8S7-n_mksLeaRPRUpiRInERoxyI",
  },
  title: "AI Clinic Receptionist — Free Open-Source AI Appointment Booking",
  description:
    "Free open-source AI receptionist for clinics. Bilingual chatbot books appointments 24/7 in English and Roman Urdu. Live Next.js demo — no signup needed.",
  keywords: [
    "AI receptionist",
    "clinic chatbot",
    "appointment booking",
    "open source",
    "Next.js",
    "Urdu chatbot",
    "healthcare AI",
    "AI appointment scheduler",
    "clinic management software",
  ],
  authors: [{ name: "Yaseen Ahmad", url: "https://yaseenahmadexe.vercel.app" }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AI Clinic Receptionist",
    title: "AI Clinic Receptionist — Free Open-Source AI Appointment Booking",
    description:
      "Free open-source AI receptionist for clinics. Bilingual chatbot books appointments 24/7 in English and Roman Urdu. Live Next.js demo — no signup needed.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI Clinic Receptionist — bilingual AI appointment booking demo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Clinic Receptionist — Free Open-Source AI Appointment Booking",
    description:
      "Free open-source AI receptionist for clinics. Bilingual chatbot books appointments 24/7 in English and Roman Urdu. Live Next.js demo — no signup needed.",
    images: ["/og-image.png"],
  },
};

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-lg font-bold text-slate-900">{CLINIC.name}</span>
    </span>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <a href="/">
              <Logo />
            </a>
            <div className="hidden items-center gap-1 sm:gap-2 md:flex">
              <a href="/" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Home
              </a>
              <a href="/doctors" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Doctors
              </a>
              <a href="/lab" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Lab
              </a>
              <a href="/admin" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Admin
              </a>
              <button
                data-open-chat
                className="ml-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Book Appointment
              </button>
            </div>
            <MobileNav />
          </nav>
        </header>

        <main>{children}</main>

        <footer className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {CLINIC.name} — {CLINIC.address}
            </p>
            <p>
              Developed by{" "}
              <a
                href="https://yaseenahmadexe.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-700 hover:text-brand-700"
              >
                Yaseen
              </a>{" "}
              — Full-Stack Developer
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/MrYaseen0"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 hover:text-brand-700"
              >
                GitHub
              </a>
              <a
                href="https://yaseenahmadexe.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 hover:text-brand-700"
              >
                Portfolio
              </a>
              <a
                href="https://x.com/yaseencecosian"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-600 hover:text-brand-700"
              >
                X
              </a>
            </div>
          </div>
          <div className="border-t border-slate-200">
            <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-400">
              Open-source demo:{" "}
              <span className="font-medium text-slate-500">ai-clinic-receptionist</span>{" "}
              (MIT)
            </p>
          </div>
        </footer>

        <ChatWidget />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener('click',function(e){var b=e.target.closest('[data-open-chat]');if(b){var p=b.getAttribute('data-prefill');window.dispatchEvent(new CustomEvent('open-chat',{detail:{prefill:p}}));}});`,
          }}
        />
      </body>
    </html>
  );
}
