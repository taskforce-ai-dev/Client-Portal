"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import type { Agent, Client, Salesperson } from "@/lib/types";

type AgentRow = Agent & {
  salesTotal: number;
  commission: number;
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const statusPill: Record<string, string> = {
  active: "pill-emerald",
  trial: "pill-cyan",
  suspended: "pill-rose",
  live: "pill-emerald",
  paused: "pill-amber",
  draft: "pill-slate",
};

export default function ClientDetail({
  client,
  initialAgents,
  salespeople,
}: {
  client: Client;
  initialAgents: AgentRow[];
  salespeople: Salesperson[];
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const [addOpen, setAddOpen] = useState(false);
  const [saleFor, setSaleFor] = useState<AgentRow | null>(null);

  function patchLocal(id: string, patch: Partial<AgentRow>) {
    setAgents((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function saveAgent(id: string, patch: Partial<Agent>) {
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const { agent } = await res.json();
      patchLocal(id, agent);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> All clients
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              <span className={statusPill[client.status] ?? "pill-slate"}>{client.status}</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">{client.company}</p>
          </div>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Login email" value={client.email} />
          <PasswordField value={client.password} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-sm text-slate-400">Assign a salesperson and commission to each agent.</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">No agents yet for this client.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{a.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 capitalize">{a.role} · {a.channel}</div>
                </div>
                <span className={statusPill[a.status] ?? "pill-slate"}>{a.status}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Salesperson</label>
                  <select
                    className="input"
                    value={a.salespersonId ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      patchLocal(a.id, { salespersonId: v });
                      saveAgent(a.id, { salespersonId: v });
                    }}
                  >
                    <option value="">— Unassigned —</option>
                    {salespeople.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Commission %</label>
                  <input
                    type="number" min={0} max={100} step={0.5}
                    className="input"
                    value={a.commissionPercent}
                    onChange={(e) => patchLocal(a.id, { commissionPercent: Number(e.target.value) })}
                    onBlur={(e) => saveAgent(a.id, { commissionPercent: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <div className="stat-label">Sales</div>
                    <div className="text-base font-semibold mt-0.5">{money(a.salesTotal)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Commission</div>
                    <div className="text-base font-semibold mt-0.5 text-emerald">{money(a.commission)}</div>
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={() => setSaleFor(a)}>
                  <TrendingUp className="w-3.5 h-3.5" /> Log sale
                </button>
              </div>

              {a.salespersonId == null && (
                <div className="mt-3 text-[11px] text-amber-300/80">No salesperson assigned</div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddAgentModal
          clientId={client.id}
          salespeople={salespeople}
          onClose={() => setAddOpen(false)}
          onCreated={(agent) => {
            setAgents((list) => [...list, { ...agent, salesTotal: 0, commission: 0 }]);
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {saleFor && (
        <AddSaleModal
          agent={saleFor}
          onClose={() => setSaleFor(null)}
          onCreated={(amount) => {
            patchLocal(saleFor.id, {
              salesTotal: saleFor.salesTotal + amount,
              commission: ((saleFor.salesTotal + amount) * saleFor.commissionPercent) / 100,
            });
            setSaleFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function PasswordField({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="label">Password</div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-slate-200">{show ? value : "••••••••••"}</span>
        <button onClick={() => setShow((s) => !s)} className="text-slate-500 hover:text-slate-300">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          className="text-slate-500 hover:text-slate-300"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="font-semibold text-lg">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddAgentModal({
  clientId,
  salespeople,
  onClose,
  onCreated,
}: {
  clientId: string;
  salespeople: Salesperson[];
  onClose: () => void;
  onCreated: (agent: Agent) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    role: "Booking Agent",
    channel: "voice",
    status: "draft",
    salespersonId: "",
    commissionPercent: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, clientId, salespersonId: form.salespersonId || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to add agent");
      onCreated(d.agent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Modal title="Add agent" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Agent name</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div>
            <label className="label">Channel</label>
            <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="voice">Voice</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Salesperson</label>
            <select className="input" value={form.salespersonId} onChange={(e) => setForm({ ...form, salespersonId: e.target.value })}>
              <option value="">— Unassigned —</option>
              {salespeople.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Commission %</label>
            <input type="number" min={0} max={100} step={0.5} className="input"
              value={form.commissionPercent}
              onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} />
          </div>
        </div>
        {error && <div className="text-xs text-rose bg-rose/10 ring-1 ring-rose/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add agent
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddSaleModal({
  agent,
  onClose,
  onCreated,
}: {
  agent: Agent;
  onClose: () => void;
  onCreated: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, amount: Number(amount), description, date }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to log sale");
      onCreated(Number(amount));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Log sale · ${agent.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Amount (USD)</label>
          <input type="number" min={0} step="0.01" className="input" required value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Booking, package, etc." />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <div className="text-xs text-rose bg-rose/10 ring-1 ring-rose/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Log sale
          </button>
        </div>
      </form>
    </Modal>
  );
}
