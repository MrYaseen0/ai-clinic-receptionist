"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  api,
  btnSecondaryCls,
} from "@/components/lab";

interface Row {
  id: string;
  status: string;
  sampleDate: string;
  reviewedBy?: string;
  patient: { name: string; serial: string } | null;
}

export default function ReportsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [a, r] = await Promise.all([
          api<{ items: Row[] }>("/api/lab/orders?status=approved"),
          api<{ items: Row[] }>("/api/lab/orders?status=report_released"),
        ]);
        setItems([...a.items, ...r.items]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Reports" sub="Approved orders — download signed PDF lab reports" />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Sample date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reviewed by</th>
              <th className="px-4 py-3">PDF</th>
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
                <td className="px-4 py-3">{o.patient?.name}</td>
                <td className="px-4 py-3">{o.sampleDate}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-slate-600">{o.reviewedBy || "—"}</td>
                <td className="px-4 py-3">
                  <a href={`/api/lab/orders/${o.id}/report`} className={btnSecondaryCls() + " !px-3 !py-1.5 !text-xs"}>
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No approved reports yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
