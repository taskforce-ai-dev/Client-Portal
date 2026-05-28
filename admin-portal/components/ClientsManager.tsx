"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type { Client } from "@/lib/types";

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

const statusPill: Record<string, string> = {
  active: "pill-emerald",
  trial: "pill-cyan",
  suspended: "pill-rose",
};

export default function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: genPassword(),
    status: "trial",
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create client");
      setClients((c) => [d.client, ...c]);
      setOpen(false);
      setForm({ name: "", company: "", email: "", password: genPassword(), status: "trial" });
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
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-slate-400 mt-1">
            {clients.length} {clients.length === 1 ? "client" : "clients"} · create accounts and hand out credentials
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New client
        </button>
      </div>

      <div className="card overflow-hidden">
        {clients.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No clients yet. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left stat-label border-b border-white/[0.08] bg-white/[0.02]">
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Password</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Created</th>
                  <th className="py-3 px-4 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.company}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{c.email}</td>
                    <td className="py-3 px-4"><Secret value={c.password} /></td>
                    <td className="py-3 px-4">
                      <span className={statusPill[c.status] ?? "pill-slate"}>{c.status}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{c.createdAt.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/clients/${c.id}`} className="text-cyan hover:underline text-xs font-medium">
                        Manage
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
              <div className="font-semibold text-lg">New client</div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact name</label>
                  <input className="input" value={form.name} required
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="input" value={form.company} placeholder="(optional)"
                    onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Login email</label>
                <input type="email" className="input" value={form.email} required
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="flex gap-2">
                  <input className="input font-mono" value={form.password} required
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" className="btn-ghost px-2.5" title="Generate"
                    onClick={() => setForm({ ...form, password: genPassword() })}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {error && (
                <div className="text-xs text-rose bg-rose/10 ring-1 ring-rose/20 rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Secret({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-slate-300">{show ? value : "••••••••••"}</span>
      <button onClick={() => setShow((s) => !s)} className="text-slate-500 hover:text-slate-300" title={show ? "Hide" : "Show"}>
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="text-slate-500 hover:text-slate-300"
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
