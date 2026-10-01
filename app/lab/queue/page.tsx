"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  StatusBadge,
  PriorityBadge,
  FlagBadge,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
} from "@/components/lab";

interface QueueItem {
  order: {
    id: string;
    status: string;
    priority: string;
    results: Record<string, Array<{ paramKey: string; value: number; flag: string }>>;
  };
  patient: { name: string; serial: string } | null;
  tests: Array<{
    id: string;
    code: string;
    name: string;
    params: Array<{ key: string; name: string; unit: string; refLow: number; refHigh: number }>;
  }>;
  pendingCount: number;
  resultsCount: number;
}

export default function LabQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api<{ items: QueueItem[] }>("/api/lab/queue");
      setItems(d.items);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const open = items.find((x) => x.order.id === openId);

  function pendingOf(item: QueueItem) {
    const done = new Set(
      Object.values(item.order.results).flat().map((e) => e.paramKey)
    );
    const out: Array<{ testId: string; code: string; key: string; name: string; unit: string; refLow: number; refHigh: number }> = [];
    for (const t of item.tests) {
      for (const p of t.params) {
        if (!done.has(p.key)) out.push({ testId: t.id, code: t.code, ...p });
      }
    }
    return out;
  }

  async function submitResults() {
    if (!open) return;
    const entries = pendingOf(open)
      .map((p) => ({ testId: p.testId, paramKey: p.key, value: Number(values[`${p.testId}:${p.key}`]) }))
      .filter((e) => Number.isFinite(e.value) && values[`${e.testId}:${e.paramKey}`] !== "");
    if (entries.length === 0) {
      setErr("Enter at least one result value.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const d = await api<{ saved: unknown[]; criticalAlerts: string[] }>(
        `/api/lab/orders/${open.order.id}/results`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries, enteredBy: "technician" }),
        }
      );
      setValues({});
      await load();
      if (d.criticalAlerts.length > 0) {
        setErr(`Saved. ${d.criticalAlerts.length} CRITICAL value(s) raised an alert — the pathologist must acknowledge before approval.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function sendToReview(id: string) {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/lab/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "under_review", by: "technician" }),
      });
      setOpenId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Technician Work Queue" sub="Enter results per parameter — H/L/N flags are automatic" />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <div className="grid gap-4">
        {items.map((item) => {
          const isOpen = openId === item.order.id;
          const pend = isOpen ? pendingOf(item) : [];
          return (
            <Card key={item.order.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/lab/orders/${item.order.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                  {item.order.id}
                </Link>
                <span className="text-sm text-slate-600">{item.patient?.name}</span>
                <PriorityBadge priority={item.order.priority} />
                <StatusBadge status={item.order.status} />
                <span className="text-xs text-slate-400">
                  {item.resultsCount} entered · {item.pendingCount} pending
                </span>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setOpenId(isOpen ? null : item.order.id)} className={btnSecondaryCls() + " !px-3 !py-1.5 !text-xs"}>
                    {isOpen ? "Close" : "Enter results"}
                  </button>
                  <button
                    disabled={busy || item.pendingCount > 0}
                    title={item.pendingCount > 0 ? "Enter all results first" : ""}
                    onClick={() => sendToReview(item.order.id)}
                    className={btnPrimaryCls() + " !px-3 !py-1.5 !text-xs"}
                  >
                    Send to review
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {/* already entered */}
                  {Object.entries(item.order.results).map(([tid, entries]) => {
                    const t = item.tests.find((x) => x.id === tid);
                    return (
                      <div key={tid} className="mb-3">
                        <p className="mb-1 text-xs font-semibold text-slate-600">{t?.code} — entered</p>
                        <div className="flex flex-wrap gap-2">
                          {entries.map((e) => (
                            <span key={e.paramKey} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs">
                              <span className="font-medium">{e.paramKey}</span>
                              <span className="font-mono font-bold">{e.value}</span>
                              <FlagBadge flag={e.flag} />
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {/* pending inputs */}
                  {pend.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pend.map((p) => (
                        <label key={`${p.testId}:${p.key}`} className="block rounded-lg border border-slate-200 p-3">
                          <span className="block text-xs font-semibold text-slate-700">
                            {p.code} · {p.name}
                          </span>
                          <span className="block text-xs text-slate-400">
                            Ref {p.refLow}–{p.refHigh} {p.unit}
                          </span>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${inputCls()} mt-1`}
                            placeholder="Enter value"
                            value={values[`${p.testId}:${p.key}`] || ""}
                            onChange={(e) =>
                              setValues((v) => ({ ...v, [`${p.testId}:${p.key}`]: e.target.value }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-700">All parameters entered — ready to send to review.</p>
                  )}
                  {pend.length > 0 && (
                    <button disabled={busy} onClick={submitResults} className={`${btnPrimaryCls()} mt-4`}>
                      {busy ? "Saving…" : "Save results"}
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {items.length === 0 && (
          <Card><p className="text-sm text-slate-500">Queue is empty — no orders awaiting results.</p></Card>
        )}
      </div>
    </div>
  );
}
