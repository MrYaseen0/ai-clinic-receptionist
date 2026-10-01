"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  PriorityBadge,
  FlagBadge,
  api,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
} from "@/components/lab";

interface ReviewItem {
  order: { id: string; priority: string; reviewNote?: string };
  patient: { name: string; serial: string } | null;
  tests: Array<{ id: string; code: string; name: string }>;
  flagged: Array<{ testCode?: string; paramName?: string; unit?: string; value: number; flag: string }>;
  openAlerts: Array<{ id: string; paramName: string; value: number; unit: string; level: string }>;
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const d = await api<{ items: ReviewItem[] }>("/api/lab/review-queue");
      setItems(d.items);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    setErr("");
    try {
      await api(`/api/lab/orders/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note[id] || "", reviewedBy: "pathologist" }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy("");
    }
  }

  async function acknowledge(alertId: string) {
    setErr("");
    try {
      await api(`/api/lab/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: "pathologist" }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Acknowledge failed");
    }
  }

  return (
    <div>
      <PageHeader title="Pathologist Review" sub="Approve or reject with notes — acknowledge critical alerts" />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.order.id} className={item.openAlerts.length > 0 ? "!border-red-200" : ""}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/lab/orders/${item.order.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                {item.order.id}
              </Link>
              <span className="text-sm text-slate-600">{item.patient?.name}</span>
              <PriorityBadge priority={item.order.priority} />
              <span className="text-xs text-slate-400">
                {item.tests.map((t) => t.code).join(", ")}
              </span>
            </div>

            {item.openAlerts.length > 0 && (
              <div className="mt-3 rounded-lg bg-red-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-red-800">Critical alerts — acknowledge to enable approval</p>
                <ul className="space-y-2">
                  {item.openAlerts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-red-800">
                        {a.level === "critical_low" ? "CRITICAL LOW" : "CRITICAL HIGH"}
                      </span>
                      <span>{a.paramName}: {a.value} {a.unit}</span>
                      <button
                        onClick={() => acknowledge(a.id)}
                        className="ml-auto rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Acknowledge
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.flagged.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Flagged values</p>
                <div className="flex flex-wrap gap-2">
                  {item.flagged.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs">
                      <span className="font-medium">{f.testCode} {f.paramName}</span>
                      <span className="font-mono font-bold">{f.value}{f.unit ? ` ${f.unit}` : ""}</span>
                      <FlagBadge flag={f.flag} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <input
                className={`${inputCls()} max-w-md flex-1 min-w-[200px]`}
                placeholder="Review note (required for rejection)"
                value={note[item.order.id] || ""}
                onChange={(e) => setNote((n) => ({ ...n, [item.order.id]: e.target.value }))}
              />
              <button
                disabled={busy === item.order.id}
                onClick={() => review(item.order.id, "approve")}
                className={btnPrimaryCls() + " !bg-emerald-600 hover:!bg-emerald-700"}
              >
                Approve
              </button>
              <button
                disabled={busy === item.order.id}
                onClick={() => review(item.order.id, "reject")}
                className={btnSecondaryCls() + " !border-red-300 !text-red-700 hover:!bg-red-50"}
              >
                Reject
              </button>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <Card><p className="text-sm text-slate-500">Nothing awaiting review.</p></Card>
        )}
      </div>
    </div>
  );
}
