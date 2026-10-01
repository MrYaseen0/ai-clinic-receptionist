"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  api,
  fmtPKR,
} from "@/components/lab";

interface DashboardData {
  todaysOrders: number;
  revenueToday: number;
  pending: number;
  unackedAlerts: number;
  outstanding: number;
  totalPatients: number;
  totalTests: number;
  activity: Array<{
    orderId: string;
    patientName: string;
    from: string | null;
    to: string;
    at: string;
    by: string;
  }>;
}

export default function LabDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/lab/dashboard")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  const stats = [
    { label: "Orders today", value: String(data.todaysOrders) },
    { label: "Revenue today", value: fmtPKR(data.revenueToday) },
    { label: "Pending orders", value: String(data.pending) },
    { label: "Open critical alerts", value: String(data.unackedAlerts) },
    { label: "Outstanding dues", value: fmtPKR(data.outstanding) },
    { label: "Patients / Tests", value: `${data.totalPatients} / ${data.totalTests}` },
  ];

  return (
    <div>
      <PageHeader
        title="Lab Dashboard"
        sub="Today's activity at a glance"
        action={
          <Link
            href="/lab/orders/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New Order
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Recent activity</h2>
        {data.activity.length === 0 && (
          <p className="text-sm text-slate-500">No activity yet.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {data.activity.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <Link
                href={`/lab/orders/${a.orderId}`}
                className="font-mono font-semibold text-brand-700 hover:underline"
              >
                {a.orderId}
              </Link>
              <span className="text-slate-600">{a.patientName}</span>
              <span className="text-slate-400">
                {a.from ? `${a.from.replace(/_/g, " ")} → ` : ""}
              </span>
              <StatusBadge status={a.to} />
              <span className="ml-auto text-xs text-slate-400">
                {new Date(a.at).toLocaleString("en-GB")} · {a.by}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
