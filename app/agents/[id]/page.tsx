import Link from "next/link";
import { redirect } from "next/navigation";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import { Phone } from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listCallSummaries } from "@/lib/adminDb";
import { getAllowedFeatures } from "@/lib/featureAccess";
import { getAgentMonthlyQuota } from "@/lib/billing";
import CallLogTable, { CallRow } from "@/components/CallLogTable";
import {
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
} from "@/lib/twilio";
import { getAgentCalls } from "@/lib/callSource";
import { HANDOVER_OUTCOME, isHandoverCall } from "@/lib/handover";

function ymdLocal(d: Date) { return d.toISOString().slice(0, 10); }
const SMARTPBX_STATUS_URL = "https://smartpbx-kavya.taskforceai.tech/smartpbx/status";

type SmartPbxStatus = {
  enabled: boolean;
  configured: boolean;
  active_sessions: number;
  max_sessions: number;
  admitted_total: number;
  rejected_capacity_total: number;
  released_total: number;
  frames_dropped_total: number;
  echo_rejections_total: number;
  protocol_version: string | null;
  transfer_enabled: boolean;
};

type SmartPbxStatusLoad = {
  state: "offline" | "ok" | "error";
  status: SmartPbxStatus | null;
  error?: string;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
  return 0;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return ["1", "true", "y", "yes", "on", "enabled", "enable"].includes(s);
  }
  return false;
}

function asStatusPayload(value: unknown): SmartPbxStatus {
  const payload = (value as Record<string, unknown>) || {};
  return {
    enabled: bool((payload as Record<string, unknown>).enabled),
    configured: bool((payload as Record<string, unknown>).configured),
    active_sessions: num((payload as Record<string, unknown>).active_sessions),
    max_sessions: num((payload as Record<string, unknown>).max_sessions),
    admitted_total: num((payload as Record<string, unknown>).admitted_total),
    rejected_capacity_total: num((payload as Record<string, unknown>).rejected_capacity_total),
    released_total: num((payload as Record<string, unknown>).released_total),
    frames_dropped_total: num((payload as Record<string, unknown>).frames_dropped_total),
    echo_rejections_total: num((payload as Record<string, unknown>).echo_rejections_total),
    protocol_version: asString((payload as Record<string, unknown>).protocol_version),
    transfer_enabled: bool((payload as Record<string, unknown>).transfer_enabled),
  };
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

async function fetchSmartpbxStatus(): Promise<SmartPbxStatusLoad> {
  const token = process.env.SMARTPBX_STATUS_TOKEN;
  if (!token) return { state: "offline", status: null, error: "SMARTPBX_STATUS_TOKEN is missing." };

  try {
    const response = await fetch(SMARTPBX_STATUS_URL, {
      headers: { "X-Kavya-SmartPBX-Token": token },
      next: { revalidate: 15 },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        state: "error",
        status: null,
        error: `TaskForce Link status HTTP ${response.status}${body ? `: ${body.slice(0, 140)}` : ""}`,
      };
    }
    const json = await response.json().catch(() => null);
    return { state: "ok", status: asStatusPayload(json) };
  } catch (e) {
    return {
      state: "error",
      status: null,
      error: e instanceof Error ? e.message : "Failed to fetch TaskForce Link status",
    };
  }
}

function SmartPbxStatusCard({ state, status, error }: SmartPbxStatusLoad) {
  const isLive = state === "ok" && status?.enabled && status.configured;
  const active = state === "ok" ? `${status?.active_sessions ?? 0} / ${status?.max_sessions ?? 0}` : "—";
  const handled = state === "ok" ? (status?.admitted_total ?? 0).toLocaleString() : "—";
  const transferEnabled = state === "ok" ? (status?.transfer_enabled ? "Yes" : "No") : "—";

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="stat-label">TaskForce Link live</div>
          <div className="text-white text-xl mt-1">TaskForce Link</div>
        </div>
        <span className={isLive ? "pill-emerald" : "pill-amber"}>
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block mr-1.5" />
          {isLive ? "Live" : "Offline"}
        </span>
      </div>
      {error ? <div className="text-xs text-rose-300 mb-3">Status error: {error}</div> : null}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="stat-label mb-1">Active calls</div>
          <div className="text-white font-semibold tabular-nums">{active}</div>
        </div>
        <div>
          <div className="stat-label mb-1">Total handled</div>
          <div className="text-white font-semibold tabular-nums">{handled}</div>
        </div>
        <div>
          <div className="stat-label mb-1">Transfer enabled</div>
          <div className="text-white font-semibold">{transferEnabled}</div>
        </div>
      </div>
      {state === "ok" && status?.protocol_version ? <div className="mt-3 text-xs text-slate-400">Protocol {status.protocol_version}</div> : null}
    </div>
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgentOverviewPage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agentDb = await findAgentForClient(params.id, session.clientId);
  if (!agentDb) redirect("/select");
  const transcriptsAllowed = (await getAllowedFeatures()).has("transcripts");
  const agent = {
    id: agentDb.id,
    name: agentDb.name,
    role: agentDb.role,
    status: agentDb.status as "live" | "paused" | "draft",
    channels: agentDb.channels.split(",").map((c) => c.trim()).filter(Boolean) as ("Voice Call" | "WhatsApp" | "SMS")[],
    gradient: agentDb.gradient,
    initial: agentDb.initial,
  };

  const [{ calls, configured, error }, summariesRaw, quota, smartpbx] = await Promise.all([
    getAgentCalls(agentDb.id, { max: 1000 }),
    listCallSummaries(agentDb.id, { limit: 100 }),
    getAgentMonthlyQuota(agentDb),
    fetchSmartpbxStatus(),
  ]);
  const summaryByCall = new Map<string, typeof summariesRaw[number]>();
  for (const s of summariesRaw) if (s.twilio_call_sid) summaryByCall.set(s.twilio_call_sid, s);

  // Reclassify completed calls as "Handed over" when the transcript/summary
  // shows the AI agent transferred to a human. Keeps the underlying Twilio
  // status but gives clients a true picture of how the conversation ended.
  const enrichedCalls = calls.map((c) => {
    if (c.outcome !== "Completed") return c;
    const sum = summaryByCall.get(c.id);
    return sum && isHandoverCall({ transcript: sum.transcript, summary: sum.summary, action_items: sum.action_items })
      ? { ...c, outcome: HANDOVER_OUTCOME }
      : c;
  });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = enrichedCalls.filter((c) => {
    if (!c.startedAtIso) return false;
    const d = new Date(c.startedAtIso);
    return !isNaN(d.getTime()) && d >= todayStart;
  });
  const { total, completionRate, completed, avgDuration } = callStats(enrichedCalls);

  const hourly = bucketCallsByHour(today);

  // Build CallRow[] grouped by outcome so the chart can drill into each
  // category with its transcripts attached. Mirrors the Calls page logic.
  const allRows: CallRow[] = enrichedCalls.map((c) => ({
    id: c.id,
    caller: c.caller,
    direction: c.direction,
    startedAt: c.startedAt,
    duration: c.duration,
    outcome: c.outcome,
    summary: (summaryByCall.get(c.id) as any) || null,
  }));
  const outcomeBuckets = bucketOutcomes(enrichedCalls);
  const rowsByOutcome = new Map<string, CallRow[]>();
  for (const r of allRows) {
    const arr = rowsByOutcome.get(r.outcome) ?? [];
    arr.push(r);
    rowsByOutcome.set(r.outcome, arr);
  }
  const outcomes = outcomeBuckets.map((b) => ({
    ...b,
    calls: rowsByOutcome.get(b.outcome) ?? [],
  }));
  const recentCalls = allRows.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${agent.gradient} text-white font-bold grid place-items-center text-xl shadow-[0_8px_24px_-8px_rgba(168,85,247,0.5)]`}
          >
            {agent.initial}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{agent.name}</h1>
              <StatusBadge status={agent.status} />
              <SourceBadge configured={configured} error={error} />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {agent.role} · {agent.channels.join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh />
          <button className="btn-ghost">
            <Phone className="w-4 h-4" /> Test call
          </button>
        </div>
      </div>

      <TwilioNotice configured={configured} error={error} />

      <SmartPbxStatusCard state={smartpbx.state} status={smartpbx.status} error={smartpbx.error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total calls" value={String(total)} delta={0} hint={`${today.length} today`} />
        <KpiCard label="Completion rate" value={`${completionRate}%`} delta={0} hint={`${completed} completed`} />
        <KpiCard label="Avg duration" value={avgDuration} delta={0} hint="All calls" />
        <KpiCard
          label="Minutes this month"
          value={quota.billableMinutes.toLocaleString()}
          delta={0}
          hint={`${quota.percent}% of ${quota.includedMinutes.toLocaleString()} included`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsChart data={hourly} total={today.length} title="Calls today" />
        </div>
        <OutcomeChart data={outcomes} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="font-semibold text-white">Recent calls</div>
          <Link
            href={`/agents/${agent.id}/calls`}
            className="text-xs text-accent-300 hover:text-accent-200"
          >
            View all →
          </Link>
        </div>
        <CallLogTable
          calls={recentCalls}
          emptyMessage={configured ? "No calls yet." : "Connect your call history to see calls."}
          transcriptsAllowed={transcriptsAllowed}
        />
      </div>
    </div>
  );
}
