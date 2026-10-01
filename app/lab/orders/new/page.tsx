"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  PageHeader,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
  fmtPKR,
} from "@/components/lab";

interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
}
interface Patient {
  id: string;
  name: string;
  serial: string;
  phone: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [tests, setTests] = useState<LabTest[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [testQ, setTestQ] = useState("");
  const [patientQ, setPatientQ] = useState("");
  const [patientHits, setPatientHits] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [priority, setPriority] = useState("routine");
  const [sampleDate, setSampleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ items: LabTest[] }>("/api/lab/tests").then((d) => setTests(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!patientQ.trim()) {
      setPatientHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const d = await api<{ items: Patient[] }>(
          `/api/lab/patients?search=${encodeURIComponent(patientQ)}&page_size=6`
        );
        setPatientHits(d.items);
      } catch {
        /* ignore */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [patientQ]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const total = tests.filter((t) => selected.includes(t.id)).reduce((s, t) => s + t.price, 0);
  const filtered = tests.filter(
    (t) =>
      t.name.toLowerCase().includes(testQ.toLowerCase()) ||
      t.code.toLowerCase().includes(testQ.toLowerCase())
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const d = await api<{ order: { id: string } }>("/api/lab/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(patientId ? { patientId } : { patientName, patientPhone }),
          testIds: selected,
          referringDoctor,
          priority,
          sampleDate,
          createdBy: "reception",
        }),
      });
      router.push(`/lab/orders/${d.order.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create order");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Lab Order"
        action={
          <Link href="/lab/orders" className="text-sm font-medium text-brand-700 hover:underline">
            Back to orders
          </Link>
        }
      />
      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold">1. Patient</h2>
          <input
            className={inputCls()}
            placeholder="Search existing patient…"
            value={patientQ}
            onChange={(e) => setPatientQ(e.target.value)}
          />
          {patientHits.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {patientHits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientQ(`${p.name} (${p.serial})`);
                      setPatientHits([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-400">{p.serial}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {patientId ? (
            <p className="mt-3 text-sm text-emerald-700">
              Selected: {patientQ}{" "}
              <button type="button" onClick={() => { setPatientId(""); setPatientQ(""); }} className="underline">
                change
              </button>
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              <p className="text-xs text-slate-500">Or register on the spot:</p>
              <input className={inputCls()} placeholder="Patient name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              <input className={inputCls()} placeholder="Phone (e.g. 03001234567)" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
            </div>
          )}
          <div className="mt-4 grid gap-3">
            <input className={inputCls()} placeholder="Referring doctor (optional)" value={referringDoctor} onChange={(e) => setReferringDoctor(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <select className={inputCls()} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
              <input className={inputCls()} type="date" value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">2. Tests</h2>
          <input className={`${inputCls()} mb-3`} placeholder="Filter tests…" value={testQ} onChange={(e) => setTestQ(e.target.value)} />
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {filtered.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 accent-teal-700" />
                  <span className="flex-1 text-sm">
                    <span className="font-mono text-xs font-bold text-brand-700">{t.code}</span>{" "}
                    {t.name}
                  </span>
                  <span className="text-sm font-semibold">{fmtPKR(t.price)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              {selected.length} test{selected.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-lg font-bold">{fmtPKR(total)}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving || selected.length === 0} className={btnPrimaryCls()}>
              {saving ? "Creating…" : "Create order"}
            </button>
            <Link href="/lab/orders" className={btnSecondaryCls()}>Cancel</Link>
          </div>
        </Card>
      </form>
    </div>
  );
}
