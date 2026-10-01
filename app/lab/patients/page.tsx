"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
} from "@/components/lab";

interface Patient {
  id: string;
  serial: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  createdAt: string;
}

export default function PatientsPage() {
  const [items, setItems] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "male",
    address: "",
  });
  const [saving, setSaving] = useState(false);

  async function load(q: string) {
    try {
      const d = await api<{ items: Patient[]; total: number }>(
        `/api/lab/patients?search=${encodeURIComponent(q)}&page_size=20`
      );
      setItems(d.items);
      setTotal(d.total);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api("/api/lab/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          age: Number(form.age),
          gender: form.gender,
          address: form.address,
        }),
      });
      setForm({ name: "", phone: "", age: "", gender: "male", address: "" });
      setShowForm(false);
      load(search);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to register");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Patients"
        sub={`${total} registered`}
        action={
          <button onClick={() => setShowForm((s) => !s)} className={btnPrimaryCls()}>
            Register Patient
          </button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold">New patient registration</h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input className={inputCls()} placeholder="Full name" value={form.name} onChange={set("name")} required />
            <input className={inputCls()} placeholder="Phone (e.g. 03001234567)" value={form.phone} onChange={set("phone")} required />
            <input className={inputCls()} placeholder="Age" type="number" min={0} max={130} value={form.age} onChange={set("age")} required />
            <select className={inputCls()} value={form.gender} onChange={set("gender")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input className={`${inputCls()} sm:col-span-2`} placeholder="Address (optional)" value={form.address} onChange={set("address")} />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className={btnPrimaryCls()}>
                {saving ? "Saving…" : "Register"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className={btnSecondaryCls()}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-4">
        <input
          className={`${inputCls()} max-w-md`}
          placeholder="Search name, phone, or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Serial</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Age/Gender</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{p.serial}</td>
                <td className="px-4 py-3">
                  <Link href={`/lab/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.phone}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.age} / {p.gender}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
