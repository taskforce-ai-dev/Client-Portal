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
  getAllCallsForSubaccount,
  isTwilioAuthConfigured,
} from "@/lib/twilio";
import { HANDOVER_OUTCOME, isHandoverCall } from "@/lib/handover";

function ymdLocal(d: Date) { return d.toISOString().slice(0, 10); }

export const dynamic = "force-dynamic";

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

  const sub = agentDb.twilio_subaccount_sid || process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID || "";
  const configuredAuth = isTwilioAuthConfigured() && !!sub;
  const [{ calls, configured, error }, summariesRaw, quota] = await Promise.all([
    configuredAuth
      ? getAllCallsForSubaccount(sub, { max: 1000 })
      : Promise.resolve({ calls: [] as any[], configured: false, error: undefined as string | undefined }),
    listCallSummaries(agentDb.id, { limit: 100 }),
    getAgentMonthlyQuota(agentDb),
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
          emptyMessage={configured ? "No calls yet." : "Connect Twilio to see calls."}
          transcriptsAllowed={transcriptsAllowed}
        />
      </div>
    </div>
  );
}
