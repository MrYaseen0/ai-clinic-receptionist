"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, StatusBadge, api, fmtPKR } from "@/components/lab";

interface Analytics {
  revenueByDay: Array<{ date: string; revenue: number }>;
  testsByCategory: Array<{ category: string; count: number }>;
  topTests: Array<{ name: string; code: string; count: number; revenue: number }>;
  ordersByStatus: Record<string, number>;
  totals: { orders: number; billed: number; collected: number; outstanding: number };
}

function BarChart({ data }: { data: Array<{ date: string; revenue: number }> }) {
  const W = 640;
  const H = 200;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const bw = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue last 14 days">
      {data.map((d, i) => {
        const h = Math.max(2, (d.revenue / max) * (H - 40));
        return (
          <g key={d.date}>
            <rect
              x={i * bw + 4}
              y={H - 24 - h}
              width={bw - 8}
              height={h}
              rx={3}
              fill={d.revenue > 0 ? "#0d9488" : "#e2e8f0"}
            >
              <title>{`${d.date}: ${fmtPKR(d.revenue)}`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={i * bw + bw / 2} y={H - 8} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 truncate text-slate-600">{label}</span>
      <div className="h-4 flex-1 rounded bg-slate-100">
        <div
          className="h-4 rounded bg-teal-600"
          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Analytics>("/api/lab/analytics")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  const maxCat = Math.max(1, ...data.testsByCategory.map((c) => c.count));
  const maxTest = Math.max(1, ...data.topTests.map((t) => t.count));

  return (
    <div>
      <PageHeader title="Lab Analytics" sub="Revenue, volumes and order statistics" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Total orders", v: String(data.totals.orders) },
          { l: "Billed", v: fmtPKR(data.totals.billed) },
          { l: "Collected", v: fmtPKR(data.totals.collected) },
          { l: "Outstanding", v: fmtPKR(data.totals.outstanding) },
        ].map((s) => (
          <Card key={s.l} className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.l}</p>
            <p className="mt-1 text-xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold">Revenue — last 14 days</h2>
          <BarChart data={data.revenueByDay} />
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">Orders by status</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.ordersByStatus).map(([s, n]) => (
              <span key={s} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <StatusBadge status={s} />
                <span className="font-bold">{n}</span>
              </span>
            ))}
          </div>
          <h2 className="mb-3 mt-6 text-base font-semibold">Test volumes by category</h2>
          <div className="space-y-2">
            {data.testsByCategory.map((c) => (
              <HBar key={c.category} label={c.category} value={c.count} max={maxCat} />
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Top tests</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {data.topTests.map((t) => (
              <div key={t.code} className="flex items-center gap-2 text-sm">
                <span className="w-44 truncate">
                  <span className="font-mono text-xs font-bold text-brand-700">{t.code}</span>{" "}
                  <span className="text-slate-600">{t.name}</span>
                </span>
                <div className="h-4 flex-1 rounded bg-slate-100">
                  <div className="h-4 rounded bg-brand-500" style={{ width: `${Math.max(2, (t.count / maxTest) * 100)}%` }} />
                </div>
                <span className="w-24 text-right font-mono text-xs text-slate-500">
                  {t.count} · {fmtPKR(t.revenue)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
