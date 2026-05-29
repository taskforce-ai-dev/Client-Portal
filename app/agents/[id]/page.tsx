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
import { workspace } from "@/lib/data";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import {
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
  callsToday,
  getCalls,
  getUsageThisMonth,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

export default async function AgentOverviewPage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agentDb = await findAgentForClient(params.id, session.clientId);
  if (!agentDb) redirect("/select");
  const agent = {
    id: agentDb.id,
    name: agentDb.name,
    role: agentDb.role,
    status: agentDb.status as "live" | "paused" | "draft",
    channels: agentDb.channels.split(",").map((c) => c.trim()).filter(Boolean) as ("Voice Call" | "WhatsApp" | "SMS")[],
    gradient: agentDb.gradient,
    initial: agentDb.initial,
  };

  const [{ calls, configured, error }, usage] = await Promise.all([
    getCalls(200),
    getUsageThisMonth(),
  ]);

  const today = callsToday(calls);
  const { convRate, booked, avgDuration } = callStats(today);
  const minutesPct = Math.round((usage.totalMinutes / workspace.minutesLimit) * 100);

  const hourly = bucketCallsByHour(today.length ? today : calls);
  const outcomes = bucketOutcomes(calls);
  const recentCalls = calls.slice(0, 5);

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
        <KpiCard label="Calls today" value={String(today.length)} delta={0} hint="From Twilio" />
        <KpiCard label="Conv. rate" value={`${convRate}%`} delta={0} hint={`${booked} booked today`} />
        <KpiCard label="Avg duration" value={avgDuration} delta={0} hint="Today" />
        <KpiCard
          label="Minutes this month"
          value={Math.round(usage.totalMinutes).toLocaleString()}
          delta={0}
          hint={`${minutesPct}% of ${workspace.minutesLimit.toLocaleString()} plan`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsChart data={hourly} total={today.length} title="Calls today" />
        </div>
        <OutcomeChart data={outcomes} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-white">Recent calls</div>
          <Link
            href={`/agents/${agent.id}/calls`}
            className="text-xs text-accent-300 hover:text-accent-200"
          >
            View all →
          </Link>
        </div>
        {recentCalls.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {configured ? "No calls yet." : "Connect Twilio to see calls."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left stat-label border-b border-white/5">
                  <th className="py-2 pr-3 font-medium">Caller</th>
                  <th className="py-2 pr-3 font-medium">Number</th>
                  <th className="py-2 pr-3 font-medium">Started</th>
                  <th className="py-2 pr-3 font-medium">Duration</th>
                  <th className="py-2 pr-3 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 pr-3 font-medium text-slate-100">{c.caller}</td>
                    <td className="py-3 pr-3 text-slate-400 font-mono text-xs">{c.number}</td>
                    <td className="py-3 pr-3 text-slate-500">{c.startedAt}</td>
                    <td className="py-3 pr-3 text-slate-300">{c.duration}</td>
                    <td className="py-3 pr-3">
                      <OutcomePill outcome={c.outcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    Booked: "pill-emerald",
    "Follow-up": "pill-accent",
    Voicemail: "pill-amber",
    "No answer": "pill-slate",
    Cancelled: "pill-rose",
  };
  return <span className={map[outcome] ?? "pill-slate"}>{outcome}</span>;
}
