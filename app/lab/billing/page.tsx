"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  api,
  inputCls,
  btnPrimaryCls,
  fmtPKR,
} from "@/components/lab";

interface Invoice {
  order: { id: string; status: string; total: number; sampleDate: string };
  patient: { name: string; serial: string } | null;
  paid: number;
  due: number;
}

export default function BillingPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [err, setErr] = useState("");
  const [payFor, setPayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api<{ items: Invoice[]; totalDue: number }>(
        `/api/lab/invoices${unpaidOnly ? "?unpaid=true" : ""}`
      );
      setItems(d.items);
      setTotalDue(d.totalDue);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidOnly]);

  async function pay(id: string, due: number) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api("/api/lab/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, amount: amt, method, receivedBy: "reception" }),
      });
      setPayFor(null);
      setAmount("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Billing"
        sub={`Outstanding: ${fmtPKR(totalDue)}`}
        action={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={unpaidOnly}
              onChange={(e) => setUnpaidOnly(e.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            Unpaid only
          </label>
        }
      />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Due</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.order.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/lab/billing/${i.order.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                    {i.order.id}
                  </Link>
                </td>
                <td className="px-4 py-3">{i.patient?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={i.order.status} /></td>
                <td className="px-4 py-3 text-right">{fmtPKR(i.order.total)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{fmtPKR(i.paid)}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtPKR(i.due)}</td>
                <td className="px-4 py-3 text-right">
                  {i.due > 0 && payFor !== i.order.id && (
                    <button
                      onClick={() => { setPayFor(i.order.id); setAmount(String(i.due)); }}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Record payment
                    </button>
                  )}
                  {payFor === i.order.id && (
                    <span className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={1}
                        max={i.due}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${inputCls()} !w-28 !py-1 !text-xs`}
                      />
                      <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputCls()} !w-auto !py-1 !text-xs`}>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="easypaisa">Easypaisa</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="bank">Bank</option>
                      </select>
                      <button disabled={busy} onClick={() => pay(i.order.id, i.due)} className={btnPrimaryCls() + " !px-2 !py-1 !text-xs"}>
                        Save
                      </button>
                      <button onClick={() => setPayFor(null)} className="text-xs text-slate-500 hover:underline">
                        ✕
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No invoices.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
