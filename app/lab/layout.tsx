"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAB_NAV, ROLE_LABELS, useLabRole, type LabRole } from "@/components/lab";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useLabRole();
  const pathname = usePathname();
  const nav = LAB_NAV[role];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white">
        <div>
          <p className="text-lg font-bold">Sehat Lab — LIMS</p>
          <p className="text-xs text-slate-400">
            Laboratory Information Management · demo module
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-300">Demo role:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as LabRole)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-400"
          >
            {(Object.keys(ROLE_LABELS) as LabRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-1">
        {nav.map((n) => {
          const active =
            n.href === "/lab" ? pathname === "/lab" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-medium ${
                active
                  ? "bg-brand-50 text-brand-700 shadow-[inset_0_-2px_0_0_var(--tw-shadow-color)] shadow-brand-600"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
