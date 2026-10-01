"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  PriorityBadge,
  FlagBadge,
  Barcode,
  api,
  fmtPKR,
  btnPrimaryCls,
  btnSecondaryCls,
} from "@/components/lab";

interface Detail {
  order: {
    id: string;
    status: string;
    priority: string;
    sampleDate: string;
    barcode: string;
    referringDoctor: string;
    total: number;
    results: Record<string, Array<{ paramKey: string; value: number; flag: string; enteredAt: string; enteredBy: string }>>;
    history: Array<{ from: string | null; to: string; at: string; by: string; note?: string }>;
    reviewNote?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  patient: { name: string; serial: string; phone: string; age: number; gender: string } | null;
  tests: Array<{
    id: string;
    code: string;
    name: string;
    price: number;
    params: Array<{ key: string; name: string; unit: string; refLow: number; refHigh: number }>;
  }>;
  alerts: Array<{ id: string; paramName: string; value: number; unit: string; level: string; acknowledged: boolean }>;
  paid: number;
}

const NEXT_ACTIONS: Record<string, Array<{ to: string; label: string }>> = {
  registered: [{ to: "sample_collected", label: "Collect sample" }],
  sample_collected: [{ to: "in_lab", label: "Receive in lab" }],
  in_lab: [{ to: "under_review", label: "Send to review" }],
  under_review: [],
  approved: [{ to: "report_released", label: "Release report" }],
  report_released: [],
};

export default function OrderDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await api<Detail>(`/api/lab/orders/${params.id}`));
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function transition(to: string) {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/lab/orders/${params.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, by: "lab-demo" }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  if (err && !data) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const o = data.order;
  const actions = NEXT_ACTIONS[o.status] || [];

  return (
    <div>
      <PageHeader
        title={o.id}
        sub={`Sample date ${o.sampleDate}`}
        action={
          <Link href="/lab/orders" className="text-sm font-medium text-brand-700 hover:underline">
            Back to orders
          </Link>
        }
      />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Patient</h3>
          <p className="font-semibold">{data.patient?.name}</p>
          <p className="font-mono text-xs text-slate-500">{data.patient?.serial}</p>
          <p className="text-sm text-slate-600">{data.patient?.phone}</p>
          <p className="text-sm text-slate-600">{data.patient?.age} / {data.patient?.gender}</p>
        </Card>
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Order</h3>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={o.status} />
            <PriorityBadge priority={o.priority} />
          </div>
          <p className="mt-2 text-sm text-slate-600">Ref: {o.referringDoctor || "—"}</p>
          <p className="text-sm text-slate-600">
            Billing: {fmtPKR(data.paid)} paid / {fmtPKR(o.total)}
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Barcode</h3>
          <Barcode text={o.barcode} />
        </Card>
      </div>

      {actions.length > 0 && (
        <Card className="mb-6">
          <h3 className="mb-3 text-sm font-semibold">Next step</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button key={a.to} disabled={busy} onClick={() => transition(a.to)} className={btnPrimaryCls()}>
                {a.label}
              </button>
            ))}
            {o.status === "under_review" && (
              <Link href="/lab/review" className={btnSecondaryCls()}>
                Open review queue
              </Link>
            )}
          </div>
        </Card>
      )}

      {data.alerts.length > 0 && (
        <Card className="mb-6 !border-red-200 !bg-red-50">
          <h3 className="mb-2 text-sm font-semibold text-red-800">Critical alerts</h3>
          <ul className="space-y-1 text-sm">
            {data.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-red-800">
                  {a.level === "critical_low" ? "CRITICAL LOW" : "CRITICAL HIGH"}
                </span>
                <span>{a.paramName}: {a.value} {a.unit}</span>
                <span className={a.acknowledged ? "text-emerald-700" : "text-amber-700"}>
                  {a.acknowledged ? "acknowledged" : "awaiting acknowledgment"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Results</h3>
          {(o.status === "approved" || o.status === "report_released") && (
            <a
              href={`/api/lab/orders/${o.id}/report`}
              className={btnSecondaryCls()}
            >
              Download PDF report
            </a>
          )}
        </div>
        {data.tests.map((t) => (
          <div key={t.id} className="mb-5">
            <p className="mb-1 text-sm font-semibold text-slate-800">
              <span className="font-mono text-xs text-brand-700">{t.code}</span> {t.name}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-1 pr-2">Parameter</th>
                  <th className="py-1 pr-2">Result</th>
                  <th className="py-1 pr-2">Unit</th>
                  <th className="py-1 pr-2">Range</th>
                  <th className="py-1">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {t.params.map((p) => {
                  const e = (o.results[t.id] || []).find((x) => x.paramKey === p.key);
                  return (
                    <tr key={p.key}>
                      <td className="py-1.5 pr-2">{p.name}</td>
                      <td className="py-1.5 pr-2 font-semibold">{e ? e.value : "—"}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{p.unit}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs text-slate-500">{p.refLow}–{p.refHigh}</td>
                      <td className="py-1.5">{e ? <FlagBadge flag={e.flag} /> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        {o.reviewNote && (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
            <span className="font-semibold">Pathologist note:</span> {o.reviewNote}
            <span className="ml-2 text-xs text-slate-400">— {o.reviewedBy}</span>
          </p>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Status timeline</h3>
        <ol className="space-y-2">
          {o.history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-slate-400">{new Date(h.at).toLocaleString("en-GB")}</span>
              {h.from && <span className="text-slate-500">{h.from.replace(/_/g, " ")} →</span>}
              <StatusBadge status={h.to} />
              <span className="text-xs text-slate-400">by {h.by}</span>
              {h.note && <span className="text-xs italic text-slate-500">“{h.note}”</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
