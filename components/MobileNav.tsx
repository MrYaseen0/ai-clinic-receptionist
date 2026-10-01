"use client";

import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/doctors", label: "Doctors" },
  { href: "/lab", label: "Lab" },
  { href: "/admin", label: "Admin" },
];

/**
 * Mobile navigation: hamburger toggle that reveals the nav links and the
 * Book Appointment button as a stacked dropdown. Desktop nav is untouched
 * and stays visible from `md` up.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-slate-200 bg-white/95 shadow-lg backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
            <button
              data-open-chat
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg bg-brand-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Book Appointment
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
