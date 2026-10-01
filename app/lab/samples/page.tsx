"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  PriorityBadge,
  api,
  btnPrimaryCls,
} from "@/components/lab";

interface Row {
  id: string;
  status: string;
  priority: string;
  sampleDate: string;
  patient: { name: string; serial: string } | null;
  resultsCount: number;
}

function sampleStage(o: Row): { label: string; next?: { to: string; label: string } } {
  const n = o.resultsCount;
  switch (o.status) {
    case "registered":
      return { label: "Pending", next: { to: "sample_collected", label: "Collect sample" } };
    case "sample_collected":
      return { label: "Collected", next: { to: "in_lab", label: "Receive in lab" } };
    case "in_lab":
      return { label: n > 0 ? "Processing" : "Received" };
    default:
      return { label: "Processing done" };
  }
}

export default function SamplesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const d = await api<{ items: Array<Row & { order: Row; pendingCount: number }> }>("/api/lab/queue");
      // Queue only has sample_collected/in_lab — fetch registered too via orders list
      const o = await api<{ items: Row[] }>("/api/lab/orders?status=registered");
      const queueRows: Row[] = d.items.map((x) => ({
        id: x.order.id,
        status: x.order.status,
        priority: x.order.priority,
        sampleDate: x.order.sampleDate,
        patient: x.patient,
        resultsCount: x.resultsCount,
      }));
      const regRows: Row[] = o.items.map((x) => ({
        id: x.id,
        status: x.status,
        priority: x.priority,
        sampleDate: x.sampleDate,
        patient: x.patient,
        resultsCount: 0,
      }));
      setItems([...regRows, ...queueRows]);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function advance(id: string, to: string) {
    setBusy(id);
    setErr("");
    try {
      await api(`/api/lab/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, by: "collection" }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const stageColor: Record<string, string> = {
    Pending: "bg-slate-100 text-slate-700",
    Collected: "bg-sky-100 text-sky-800",
    Received: "bg-amber-100 text-amber-800",
    Processing: "bg-violet-100 text-violet-800",
    "Processing done": "bg-emerald-100 text-emerald-800",
  };

  return (
    <div>
      <PageHeader title="Sample Tracking" sub="pending → collected → received → processing" />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Sample stage</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Order status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((o) => {
              const st = sampleStage(o);
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/lab/orders/${o.id}`} className="whitespace-nowrap font-mono font-semibold text-brand-700 hover:underline">
                      {o.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.patient?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${stageColor[st.label]}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={o.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    {st.next && (
                      <button
                        disabled={busy === o.id}
                        onClick={() => advance(o.id, st.next!.to)}
                        className={btnPrimaryCls() + " !px-3 !py-1.5 !text-xs"}
                      >
                        {busy === o.id ? "…" : st.next.label}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No active samples.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
