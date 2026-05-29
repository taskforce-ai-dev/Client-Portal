"use client";

import { useState } from "react";
import Link from "next/link";
import KnowledgeEditor from "@/components/KnowledgeEditor";

type Agent = {
  id: string;
  name: string;
  role: string;
  type: string;
  status: string;
  description: string | null;
  channels: string;
};

type Analytics = {
  configured: boolean;
  callsToday: number;
  convRate: number;
  booked: number;
  avgDuration: string;
  minutesUsed: number;
};

const TABS = [
  ["overview", "Overview"],
  ["knowledge", "Knowledge Base"],
  ["analytics", "Analytics"],
  ["settings", "Settings"],
] as const;

export default function AgentConfigView({
  agent,
  clientCompany,
  clientId,
  analytics,
}: {
  agent: Agent;
  clientCompany: string;
  clientId: string;
  analytics: Analytics;
}) {
  const [tab, setTab] = useState<string>("overview");
  const [form, setForm] = useState({
    name: agent.name,
    role: agent.role || "",
    type: agent.type || "voice",
    status: agent.status || "live",
    description: agent.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Save failed");
      setMsg({ kind: "ok", text: "Saved" });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#05070d", color: "#e7ecf5" }}>
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="text-sm text-cyan-400 shrink-0">← Admin</Link>
            <span className="text-slate-600">/</span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 grid place-items-center font-bold text-ink-950 shrink-0">
              {(agent.name[0] || "A").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{agent.name}</div>
              <div className="text-xs text-slate-400 truncate">{clientCompany} · {agent.channels}</div>
            </div>
          </div>
          <span className={"pill-emerald shrink-0"}>{agent.status}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6">
        <div className="flex gap-1 border-b border-white/10 mt-4">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (tab === k ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="py-6">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Calls today" value={String(analytics.callsToday)} />
                <Kpi label="Conv. rate" value={`${analytics.convRate}%`} />
                <Kpi label="Booked" value={String(analytics.booked)} />
                <Kpi label="Avg duration" value={analytics.avgDuration} />
              </div>
              <div className="card p-5">
                <div className="text-sm font-semibold text-white mb-2">About this agent</div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{agent.description || "No description yet. Add one in Settings."}</p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Row label="Role / persona" value={agent.role || "—"} />
                  <Row label="Type" value={agent.type} />
                  <Row label="Channels" value={agent.channels} />
                  <Row label="Status" value={agent.status} />
                </div>
              </div>
            </div>
          )}

          {tab === "knowledge" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Edit what <span className="text-slate-200">{agent.name}</span> knows. This is the same knowledge base the client edits in their portal — changes sync both ways.
              </p>
              <KnowledgeEditor endpoint={`/api/agents/${agent.id}/kb`} allowUpload={false} />
            </div>
          )}

          {tab === "analytics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi label="Calls today" value={String(analytics.callsToday)} />
                <Kpi label="Conversion" value={`${analytics.convRate}%`} />
                <Kpi label="Booked" value={String(analytics.booked)} />
                <Kpi label="Minutes used (mo)" value={String(analytics.minutesUsed)} />
              </div>
              {!analytics.configured && (
                <div className="card p-4 text-sm text-amber-300/90">
                  Live call analytics show once Twilio is connected for this workspace. The numbers above are workspace-wide.
                </div>
              )}
            </div>
          )}

          {tab === "settings" && (
            <div className="card p-5 max-w-2xl space-y-4">
              <Field label="Agent name">
                <input className="input-dark" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Role / persona (e.g. Sales person, Booking agent)">
                <input className="input-dark" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Sales person" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select className="input-dark" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="voice">Voice</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="both">Voice + WhatsApp</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className="input-dark" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="live">Live</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea className="input-dark" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                {msg && <span className={"text-sm " + (msg.kind === "ok" ? "text-emerald-400" : "text-rose-400")}>{msg.text}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono text-right">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
