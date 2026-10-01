"use client";

import { useEffect, useState } from "react";
import {
  Card,
  PageHeader,
  api,
  inputCls,
  btnPrimaryCls,
  btnSecondaryCls,
} from "@/components/lab";

interface Item {
  id: string;
  name: string;
  category: string;
  lot: string;
  qty: number;
  unit: string;
  minStock: number;
  expiry: string;
  supplier: string;
}

interface Alerts {
  expired: Item[];
  expiringSoon: Item[];
  lowStock: Item[];
}

const EMPTY = { name: "", category: "reagent", lot: "", qty: "", unit: "", minStock: "", expiry: "", supplier: "" };

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [a, b] = await Promise.all([
        api<{ items: Item[] }>("/api/lab/inventory"),
        api<Alerts>("/api/lab/inventory/alerts"),
      ]);
      setItems(a.items);
      setAlerts(b);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function adjust(id: string, delta: number) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    try {
      await api(`/api/lab/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: Math.max(0, item.qty + delta) }),
      });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    try {
      await api(`/api/lab/inventory/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/lab/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          lot: form.lot,
          qty: Number(form.qty),
          unit: form.unit,
          minStock: Number(form.minStock),
          expiry: form.expiry,
          supplier: form.supplier,
        }),
      });
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function rowClass(i: Item): string {
    if (alerts?.expired.some((x) => x.id === i.id)) return "!bg-red-50";
    if (alerts?.expiringSoon.some((x) => x.id === i.id)) return "!bg-amber-50";
    if (alerts?.lowStock.some((x) => x.id === i.id)) return "!bg-orange-50";
    return "";
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        sub="Reagents & consumables — lots, expiry, low-stock alerts"
        action={
          <button onClick={() => setShowForm((s) => !s)} className={btnPrimaryCls()}>
            Add Item
          </button>
        }
      />

      {alerts && (alerts.expired.length + alerts.expiringSoon.length + alerts.lowStock.length > 0) && (
        <Card className="mb-6 !border-amber-200 !bg-amber-50">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">Alerts</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            {alerts.expired.map((i) => (
              <li key={"e" + i.id}>EXPIRED: {i.name} (lot {i.lot}, expired {i.expiry})</li>
            ))}
            {alerts.expiringSoon.map((i) => (
              <li key={"s" + i.id}>Expiring within 30 days: {i.name} (lot {i.lot}, {i.expiry})</li>
            ))}
            {alerts.lowStock.map((i) => (
              <li key={"l" + i.id}>Low stock: {i.name} — {i.qty} {i.unit} left (min {i.minStock})</li>
            ))}
          </ul>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="mb-4 text-base font-semibold">New inventory item</h2>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
            <input className={`${inputCls()} sm:col-span-2`} placeholder="Item name" value={form.name} onChange={set("name")} required />
            <select className={inputCls()} value={form.category} onChange={set("category")}>
              <option value="reagent">Reagent</option>
              <option value="consumable">Consumable</option>
            </select>
            <input className={inputCls()} placeholder="Lot number" value={form.lot} onChange={set("lot")} />
            <input className={inputCls()} placeholder="Quantity" type="number" min={0} value={form.qty} onChange={set("qty")} required />
            <input className={inputCls()} placeholder="Unit (e.g. kits)" value={form.unit} onChange={set("unit")} />
            <input className={inputCls()} placeholder="Min stock" type="number" min={0} value={form.minStock} onChange={set("minStock")} required />
            <input className={inputCls()} type="date" value={form.expiry} onChange={set("expiry")} required />
            <input className={inputCls()} placeholder="Supplier" value={form.supplier} onChange={set("supplier")} />
            <div className="flex gap-2 sm:col-span-3">
              <button type="submit" disabled={busy} className={btnPrimaryCls()}>{busy ? "Saving…" : "Add item"}</button>
              <button type="button" onClick={() => setShowForm(false)} className={btnSecondaryCls()}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id} className={`hover:bg-slate-50 ${rowClass(i)}`}>
                <td className="px-4 py-3">
                  <span className="font-medium">{i.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{i.category}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{i.lot || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {i.qty} <span className="font-normal text-slate-400">{i.unit}</span>
                  {i.qty <= i.minStock && <span className="ml-1 text-xs text-red-600">LOW</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{i.expiry}</td>
                <td className="px-4 py-3 text-slate-600">{i.supplier || "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex gap-1">
                    <button onClick={() => adjust(i.id, 1)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100">+1</button>
                    <button onClick={() => adjust(i.id, -1)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100">−1</button>
                    <button onClick={() => remove(i.id)} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Del</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
