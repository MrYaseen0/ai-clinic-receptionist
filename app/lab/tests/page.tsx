"use client";

import { useEffect, useState } from "react";
import {
  Card,
  PageHeader,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
  fmtPKR,
} from "@/components/lab";

interface LabParam {
  key: string;
  name: string;
  unit: string;
  refLow: number;
  refHigh: number;
  criticalLow?: number;
  criticalHigh?: number;
}
interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  sampleType: string;
  turnaroundHrs: number;
  params: LabParam[];
}

const EMPTY = {
  code: "",
  name: "",
  category: "",
  price: "",
  sampleType: "Serum",
  turnaroundHrs: "6",
  paramsText: "",
};

export default function TestsPage() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const d = await api<{ items: LabTest[]; categories: string[] }>(
        `/api/lab/tests?category=${encodeURIComponent(cat)}&search=${encodeURIComponent(q)}`
      );
      setTests(d.items);
      setCategories(d.categories);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function openEdit(t: LabTest) {
    setEditing(t);
    setForm({
      code: t.code,
      name: t.name,
      category: t.category,
      price: String(t.price),
      sampleType: t.sampleType,
      turnaroundHrs: String(t.turnaroundHrs),
      paramsText: "",
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      if (editing) {
        await api(`/api/lab/tests/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            price: Number(form.price),
            category: form.category,
            sampleType: form.sampleType,
            turnaroundHrs: Number(form.turnaroundHrs),
          }),
        });
      } else {
        // paramsText format: key | Name | unit | low | high | critLow | critHigh (one per line)
        const params = form.paramsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [key, name, unit, low, high, cL, cH] = l.split("|").map((s) => s.trim());
            return {
              key: (key || "").toLowerCase(),
              name: name || "",
              unit: unit || "",
              refLow: Number(low),
              refHigh: Number(high),
              ...(cL ? { criticalLow: Number(cL) } : {}),
              ...(cH ? { criticalHigh: Number(cH) } : {}),
            };
          });
        await api("/api/lab/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            category: form.category,
            price: Number(form.price),
            sampleType: form.sampleType,
            turnaroundHrs: Number(form.turnaroundHrs),
            params,
          }),
        });
      }
      setForm(EMPTY);
      setEditing(null);
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Deactivate this test? Historical orders keep working.")) return;
    try {
      await api(`/api/lab/tests/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Test Catalog"
        sub={`${tests.length} active tests`}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
              setShowForm((s) => !s);
            }}
            className={btnPrimaryCls()}
          >
            Add Test
          </button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold">
            {editing ? `Edit ${editing.code}` : "New test"}
          </h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input className={inputCls()} placeholder="Code (e.g. CBC)" value={form.code} onChange={set("code")} disabled={!!editing} required />
            <input className={inputCls()} placeholder="Test name" value={form.name} onChange={set("name")} required />
            <input className={inputCls()} placeholder="Category (e.g. Hematology)" list="cats" value={form.category} onChange={set("category")} required />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <input className={inputCls()} placeholder="Price (PKR)" type="number" min={0} value={form.price} onChange={set("price")} required />
            <input className={inputCls()} placeholder="Sample type" value={form.sampleType} onChange={set("sampleType")} />
            <input className={inputCls()} placeholder="Turnaround (hours)" type="number" min={1} value={form.turnaroundHrs} onChange={set("turnaroundHrs")} />
            {!editing && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Parameters — one per line: key | Name | unit | refLow | refHigh | critLow | critHigh
                </label>
                <textarea
                  className={`${inputCls()} font-mono`}
                  rows={4}
                  placeholder={"hb | Hemoglobin | g/dL | 12 | 16 | 7 | 20"}
                  value={form.paramsText}
                  onChange={set("paramsText")}
                  required
                />
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className={btnPrimaryCls()}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create test"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className={btnSecondaryCls()}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputCls()} max-w-xs`} placeholder="Search tests…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls() + " max-w-[200px]"} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {tests.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-brand-700">{t.code}</p>
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <p className="text-xs text-slate-500">
                  {t.category} · {t.sampleType} · {t.turnaroundHrs}h turnaround
                </p>
              </div>
              <p className="font-bold text-slate-900">{fmtPKR(t.price)}</p>
            </div>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-2">Parameter</th>
                  <th className="py-1 pr-2">Range</th>
                  <th className="py-1">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {t.params.map((p) => (
                  <tr key={p.key}>
                    <td className="py-1 pr-2 font-medium">{p.name} <span className="text-slate-400">({p.unit})</span></td>
                    <td className="py-1 pr-2 font-mono">{p.refLow}–{p.refHigh}</td>
                    <td className="py-1 font-mono text-red-700">
                      {p.criticalLow !== undefined || p.criticalHigh !== undefined
                        ? `${p.criticalLow ?? "—"} / ${p.criticalHigh ?? "—"}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(t)} className="text-xs font-semibold text-brand-700 hover:underline">Edit</button>
              <button onClick={() => remove(t.id)} className="text-xs font-semibold text-red-600 hover:underline">Deactivate</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
