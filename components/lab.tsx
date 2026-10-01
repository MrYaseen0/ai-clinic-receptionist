"use client";

import { useEffect, useState, type ReactNode } from "react";

export type LabRole =
  | "admin"
  | "manager"
  | "receptionist"
  | "technician"
  | "pathologist";

export const ROLE_LABELS: Record<LabRole, string> = {
  admin: "Admin",
  manager: "Lab Manager",
  receptionist: "Receptionist",
  technician: "Technician",
  pathologist: "Pathologist",
};

const ALL_NAV = [
  { href: "/lab", label: "Dashboard" },
  { href: "/lab/patients", label: "Patients" },
  { href: "/lab/tests", label: "Tests" },
  { href: "/lab/orders", label: "Orders" },
  { href: "/lab/samples", label: "Samples" },
  { href: "/lab/queue", label: "Lab Queue" },
  { href: "/lab/review", label: "Review" },
  { href: "/lab/reports", label: "Reports" },
  { href: "/lab/billing", label: "Billing" },
  { href: "/lab/analytics", label: "Analytics" },
  { href: "/lab/inventory", label: "Inventory" },
  { href: "/lab/qc", label: "QC" },
];

/** Demo role-based navigation (lims-pro role table, UI-level gating). */
export const LAB_NAV: Record<LabRole, Array<{ href: string; label: string }>> = {
  admin: ALL_NAV,
  manager: ALL_NAV,
  receptionist: ALL_NAV.filter((n) =>
    ["/lab", "/lab/patients", "/lab/orders", "/lab/billing"].includes(n.href)
  ),
  technician: ALL_NAV.filter((n) =>
    ["/lab", "/lab/orders", "/lab/samples", "/lab/queue"].includes(n.href)
  ),
  pathologist: ALL_NAV.filter((n) =>
    ["/lab", "/lab/orders", "/lab/review", "/lab/reports"].includes(n.href)
  ),
};

export function useLabRole(): [LabRole, (r: LabRole) => void] {
  const [role, setRole] = useState<LabRole>("receptionist");
  useEffect(() => {
    const saved = localStorage.getItem("lab-role");
    if (saved && saved in ROLE_LABELS) setRole(saved as LabRole);
  }, []);
  const set = (r: LabRole) => {
    setRole(r);
    localStorage.setItem("lab-role", r);
  };
  return [role, set];
}

export function fmtPKR(n: number): string {
  return "Rs. " + Number(n || 0).toLocaleString("en-PK");
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  registered: "bg-slate-100 text-slate-700",
  sample_collected: "bg-sky-100 text-sky-800",
  in_lab: "bg-amber-100 text-amber-800",
  under_review: "bg-violet-100 text-violet-800",
  approved: "bg-emerald-100 text-emerald-800",
  report_released: "bg-teal-100 text-teal-800",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || "bg-slate-100 text-slate-700"}`}
    >
      {label}
    </span>
  );
}

const FLAG_STYLES: Record<string, string> = {
  N: "bg-emerald-50 text-emerald-700 border-emerald-200",
  L: "bg-amber-50 text-amber-700 border-amber-200",
  H: "bg-amber-50 text-amber-700 border-amber-200",
  CL: "bg-red-100 text-red-800 border-red-300",
  CH: "bg-red-100 text-red-800 border-red-300",
};

export function FlagBadge({ flag }: { flag: string }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-xs font-bold ${FLAG_STYLES[flag] || FLAG_STYLES.N}`}
      title={flag === "N" ? "Normal" : flag === "L" ? "Low" : flag === "H" ? "High" : flag === "CL" ? "Critical Low" : "Critical High"}
    >
      {flag}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    routine: "bg-slate-100 text-slate-600",
    urgent: "bg-orange-100 text-orange-800",
    stat: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${styles[priority] || styles.routine}`}
    >
      {priority}
    </span>
  );
}

export function inputCls() {
  return "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
}

export function btnPrimaryCls() {
  return "rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
}

export function btnSecondaryCls() {
  return "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
}

/** Simple deterministic barcode (SVG bars) from a string. */
export function Barcode({ text, height = 44 }: { text: string; height?: number }) {
  let x = 0;
  const bars: Array<{ x: number; w: number }> = [];
  for (const ch of text) {
    const w = 1 + (ch.charCodeAt(0) % 3);
    bars.push({ x, w });
    x += w + 1.6;
  }
  return (
    <div>
      <svg width={Math.ceil(x)} height={height} aria-label={`Barcode ${text}`}>
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={0} width={b.w} height={height - 12} fill="#0f172a" />
        ))}
        <text x={0} y={height - 1} fontSize={10} fill="#475569" fontFamily="monospace">
          {text}
        </text>
      </svg>
    </div>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
