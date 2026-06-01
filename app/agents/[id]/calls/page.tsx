import { redirect } from "next/navigation";
import { Download, Filter, Play, Search } from "lucide-react";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import { getAllCallsForSubaccount, isTwilioAuthConfigured } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const outcomePill: Record<string, string> = {
  Completed: "pill-emerald",
  "In progress": "pill-accent",
  Busy: "pill-amber",
  "No answer": "pill-slate",
  Failed: "pill-rose",
  Canceled: "pill-rose",
};

const sentimentColor: Record<string, string> = {
  positive: "text-emerald-400",
  neutral: "text-slate-400",
  negative: "text-rose-400",
};

export default async function CallLogsPage({ params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  const sub = agent.twilio_subaccount_sid || process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID || "";
  const configuredAuth = isTwilioAuthConfigured() && !!sub;
  const { calls, configured, error } = configuredAuth
    ? await getAllCallsForSubaccount(sub, { max: 1000 })
    : { calls: [] as any[], configured: false, error: undefined as string | undefined };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Call Logs</h1>
            <SourceBadge configured={configured} error={error} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {calls.length} {calls.length === 1 ? "call" : "calls"} · live from Twilio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh />
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input placeholder="Search by caller or number…" className="input-dark" />
          </div>
          <button className="btn-ghost">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="btn-ghost">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <TwilioNotice configured={configured} error={error} />

      <div className="card overflow-hidden">
        {calls.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {configured && !error ? "No calls yet." : "No live call data to show."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
                  <th className="py-3 px-4 font-medium">Call ID</th>
                  <th className="py-3 px-4 font-medium">Caller</th>
                  <th className="py-3 px-4 font-medium">Number</th>
                  <th className="py-3 px-4 font-medium">Direction</th>
                  <th className="py-3 px-4 font-medium">Started</th>
                  <th className="py-3 px-4 font-medium">Duration</th>
                  <th className="py-3 px-4 font-medium">Outcome</th>
                  <th className="py-3 px-4 font-medium">Sentiment</th>
                  <th className="py-3 px-4 font-medium text-right">Recording</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">
                      {c.id.length > 12 ? c.id.slice(0, 6) + "…" + c.id.slice(-4) : c.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-100">{c.caller}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">{c.number}</td>
                    <td className="py-3 px-4 text-slate-300 capitalize">{c.direction}</td>
                    <td className="py-3 px-4 text-slate-500">{c.startedAt}</td>
                    <td className="py-3 px-4 text-slate-300">{c.duration}</td>
                    <td className="py-3 px-4">
                      <span className={outcomePill[c.outcome] ?? "pill-slate"}>{c.outcome}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`capitalize text-xs font-medium ${sentimentColor[c.sentiment]}`}>
                        {c.sentiment}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="inline-flex items-center gap-1.5 text-accent-300 hover:text-accent-200 text-xs font-medium">
                        <Play className="w-3 h-3" /> Play
                      </button>
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
