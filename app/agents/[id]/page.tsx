import Link from "next/link";
import { notFound } from "next/navigation";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import { Phone, Plus } from "lucide-react";
import { agents, calls } from "@/lib/data";

export default function AgentOverviewPage({ params }: { params: { id: string } }) {
  const agent = agents.find((a) => a.id === params.id);
  if (!agent) notFound();

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {agent.role} · {agent.channels.join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost">
            <Phone className="w-4 h-4" /> Test call
          </button>
          <button className="btn-primary">
            <Plus className="w-4 h-4" /> Outbound campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Calls today" value={String(agent.callsToday)} delta={12} hint="vs yesterday" />
        <KpiCard label="Conv. rate" value={`${agent.convRate}%`} delta={4.2} hint="Booked / total" />
        <KpiCard label="Avg duration" value={agent.avgDuration} delta={-3.1} hint="Trending shorter" />
        <KpiCard label="Minutes this month" value="1,820" delta={8} hint="36% of plan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsChart />
        </div>
        <OutcomeChart />
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
