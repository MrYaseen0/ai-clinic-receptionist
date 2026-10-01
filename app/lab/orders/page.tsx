"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  PriorityBadge,
  api,
  inputCls,
  fmtPKR,
} from "@/components/lab";

interface OrderRow {
  id: string;
  status: string;
  priority: string;
  total: number;
  paid: number;
  sampleDate: string;
  createdAt: string;
  patient: { name: string; serial: string } | null;
}

const STATUSES = ["", "registered", "sample_collected", "in_lab", "under_review", "approved", "report_released"];
const PRIORITIES = ["", "routine", "urgent", "stat"];

export default function OrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try {
      const d = await api<{ items: OrderRow[] }>(
        `/api/lab/orders?status=${status}&priority=${priority}&search=${encodeURIComponent(q)}`
      );
      setItems(d.items);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div>
      <PageHeader
        title="Lab Orders"
        sub={`${items.length} orders`}
        action={
          <Link href="/lab/orders/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            New Order
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls()} max-w-xs`} placeholder="Search order, patient…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls() + " max-w-[190px]"} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>
          ))}
        </select>
        <select className={inputCls() + " max-w-[160px]"} value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p || "All priorities"}</option>
          ))}
        </select>
      </div>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Sample date</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/lab/orders/${o.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                    {o.id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {o.patient?.name}
                  <span className="block font-mono text-xs text-slate-400">{o.patient?.serial}</span>
                </td>
                <td className="px-4 py-3">{o.sampleDate}</td>
                <td className="px-4 py-3"><PriorityBadge priority={o.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-right font-medium">{fmtPKR(o.total)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
