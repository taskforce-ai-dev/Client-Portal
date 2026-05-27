import { Download, Filter, Play, Search } from "lucide-react";
import SourceBadge from "@/components/SourceBadge";
import { getCalls } from "@/lib/twilio";

export const revalidate = 30;

const outcomePill: Record<string, string> = {
  Booked: "pill-emerald",
  "Follow-up": "pill-accent",
  Voicemail: "pill-amber",
  "No answer": "pill-slate",
  Cancelled: "pill-rose",
};

const sentimentColor: Record<string, string> = {
  positive: "text-emerald-400",
  neutral: "text-slate-400",
  negative: "text-rose-400",
};

export default async function CallLogsPage() {
  const { calls, source, error } = await getCalls(100);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Call Logs</h1>
            <SourceBadge source={source} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {calls.length} {calls.length === 1 ? "call" : "calls"} ·{" "}
            {source === "twilio" ? "live from Twilio" : "showing demo data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {error && (
        <div className="card p-4 border border-amber-500/20 bg-amber-500/[0.04]">
          <div className="text-sm text-amber-300 font-medium">Twilio connection error</div>
          <div className="text-xs text-amber-200/70 mt-1 font-mono break-all">{error}</div>
        </div>
      )}

      <div className="card overflow-hidden">
        {calls.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No calls yet.</div>
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
