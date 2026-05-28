"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

type Row = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  agents: number;
  clients: number;
  salesTotal: number;
  commission: number;
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function SalespeopleManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/salespeople", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to add salesperson");
      setRows((r) => [
        { ...d.salesperson, agents: 0, clients: 0, salesTotal: 0, commission: 0 },
        ...r,
      ]);
      setOpen(false);
      setForm({ name: "", email: "", phone: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Salespeople</h1>
          <p className="text-sm text-slate-400 mt-1">
            {rows.length} {rows.length === 1 ? "person" : "people"} · assign them to agents and track commission
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New salesperson
        </button>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No salespeople yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left stat-label border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Agents</th>
                  <th className="py-3 px-4 font-medium">Clients</th>
                  <th className="py-3 px-4 font-medium">Sales</th>
                  <th className="py-3 px-4 font-medium">Commission</th>
                  <th className="py-3 px-4 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-medium text-slate-100">{r.name}</td>
                    <td className="py-3 px-4 text-slate-300">{r.email}</td>
                    <td className="py-3 px-4 text-slate-300">{r.agents}</td>
                    <td className="py-3 px-4 text-slate-300">{r.clients}</td>
                    <td className="py-3 px-4 text-slate-200">{money(r.salesTotal)}</td>
                    <td className="py-3 px-4 text-emerald font-medium">{money(r.commission)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/reports?sp=${r.id}`} className="text-cyan hover:underline text-xs font-medium">
                        Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="font-semibold text-lg">New salesperson</div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              {error && <div className="text-xs text-rose bg-rose/10 ring-1 ring-rose/20 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
