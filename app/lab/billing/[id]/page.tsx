"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, api, fmtPKR } from "@/components/lab";

interface Detail {
  order: {
    id: string;
    status: string;
    sampleDate: string;
    total: number;
    payments: Array<{ id: string; amount: number; method: string; date: string; receivedBy: string }>;
  };
  patient: { name: string; serial: string; phone: string } | null;
  tests: Array<{ code: string; name: string; price: number }>;
  paid: number;
  due: number;
}

export default function InvoiceDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Detail>(`/api/lab/invoices/${params.id}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={`Invoice ${data.order.id}`}
        action={
          <Link href="/lab/billing" className="text-sm font-medium text-brand-700 hover:underline">
            Back to billing
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Line items</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {data.tests.map((t, i) => (
                <tr key={i}>
                  <td className="py-2">
                    <span className="font-mono text-xs text-brand-700">{t.code}</span> {t.name}
                  </td>
                  <td className="py-2 text-right font-medium">{fmtPKR(t.price)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{fmtPKR(data.order.total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-600">
            Patient: {data.patient?.name} ({data.patient?.serial})
          </p>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Payment history</h3>
          {data.order.payments.length === 0 && (
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          )}
          <ul className="space-y-2">
            {data.order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {fmtPKR(p.amount)} <span className="text-xs text-slate-500">· {p.method} · {p.receivedBy}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(p.date).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <p className="flex justify-between"><span>Paid</span><span className="font-semibold text-emerald-700">{fmtPKR(data.paid)}</span></p>
            <p className="flex justify-between"><span>Balance due</span><span className="font-bold">{fmtPKR(data.due)}</span></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
