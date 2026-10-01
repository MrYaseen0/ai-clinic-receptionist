"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  PriorityBadge,
  api,
  fmtPKR,
} from "@/components/lab";

interface Detail {
  patient: {
    id: string;
    serial: string;
    name: string;
    phone: string;
    age: number;
    gender: string;
    address?: string;
  };
  orders: Array<{
    id: string;
    status: string;
    priority: string;
    total: number;
    sampleDate: string;
    createdAt: string;
  }>;
}

export default function PatientDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Detail>(`/api/lab/patients/${params.id}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const p = data.patient;

  return (
    <div>
      <PageHeader
        title={p.name}
        sub={`Serial ${p.serial}`}
        action={
          <Link href="/lab/patients" className="text-sm font-medium text-brand-700 hover:underline">
            Back to patients
          </Link>
        }
      />
      <Card className="mb-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-xs uppercase text-slate-500">Phone</dt><dd className="font-medium">{p.phone}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Age / Gender</dt><dd className="font-medium">{p.age} / {p.gender}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Address</dt><dd className="font-medium">{p.address || "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Orders</dt><dd className="font-medium">{data.orders.length}</dd></div>
        </dl>
      </Card>
      <Card className="!p-0 overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-4 text-base font-semibold">Order history</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/lab/orders/${o.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                    {o.id}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.sampleDate}</td>
                <td className="px-4 py-3"><PriorityBadge priority={o.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-right font-medium">{fmtPKR(o.total)}</td>
              </tr>
            ))}
            {data.orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
