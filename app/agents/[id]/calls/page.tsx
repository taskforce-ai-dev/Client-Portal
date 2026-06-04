import { Fragment } from "react";
import { redirect } from "next/navigation";
import { Calendar, ChevronDown, Download, FileText, Filter, Phone as PhoneIcon, Search } from "lucide-react";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listCallSummaries } from "@/lib/adminDb";
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
  const [{ calls, configured, error }, summariesRaw] = await Promise.all([
    configuredAuth
      ? getAllCallsForSubaccount(sub, { max: 1000 })
      : Promise.resolve({ calls: [] as any[], configured: false, error: undefined as string | undefined }),
    listCallSummaries(agent.id, { limit: 1000 }),
  ]);
  // Index summaries by Twilio Call SID so we can render one inline per call.
  const summaryByCall = new Map<string, typeof summariesRaw[number]>();
  for (const s of summariesRaw) if (s.twilio_call_sid) summaryByCall.set(s.twilio_call_sid, s);
  const summarizedCount = calls.reduce((n, c) => n + (summaryByCall.has(c.id) ? 1 : 0), 0);

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
            {summarizedCount > 0 && ` · ${summarizedCount} with summaries`}
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
                  <th className="py-3 px-4 font-medium text-right">Summary</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => {
                  const sum = summaryByCall.get(c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr className={"border-b border-white/5 last:border-0 hover:bg-white/[0.02] " + (sum ? "" : "")}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          {c.id.length > 12 ? c.id.slice(0, 6) + "…" + c.id.slice(-4) : c.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-100">{sum?.caller_name || c.caller}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{sum?.caller_phone || c.number}</td>
                        <td className="py-3 px-4 text-slate-300 capitalize">{c.direction}</td>
                        <td className="py-3 px-4 text-slate-500">{c.startedAt}</td>
                        <td className="py-3 px-4 text-slate-300">{c.duration}</td>
                        <td className="py-3 px-4">
                          <span className={outcomePill[c.outcome] ?? "pill-slate"}>{c.outcome}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs">
                          {sum ? (
                            <span className="inline-flex items-center gap-1 text-accent-300">
                              <FileText className="w-3 h-3" /> View
                              <ChevronDown className="w-3 h-3 opacity-60" />
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                      {sum && (
                        <tr className="border-b border-white/5 last:border-0">
                          <td colSpan={8} className="p-0">
                            <details className="group">
                              <summary className="cursor-pointer list-none px-4 py-2 text-xs text-slate-500 hover:text-slate-300 select-none flex items-center gap-2">
                                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                <span className="font-medium text-slate-300">{sum.caller_name || c.caller}</span>
                                <span className="text-slate-600">·</span>
                                <span className="truncate max-w-[60ch]">{firstLine(sum.summary)}</span>
                              </summary>
                              <SummaryCard sum={sum} />
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function firstLine(s: string): string {
  const t = (s || "").trim();
  const nl = t.indexOf("\n");
  return nl > 0 ? t.slice(0, nl) : t;
}

function bullets(s: string | null) {
  if (!s) return [] as string[];
  return s.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
}

function SummaryCard({ sum }: { sum: any }) {
  const keyPoints = bullets(sum.key_points);
  const actionItems = bullets(sum.action_items);
  const topics: string[] = (sum.topics || "").split(",").map((t: string) => t.trim()).filter(Boolean);
  const sentimentCls: Record<string, string> = { positive: "pill-emerald", neutral: "pill-slate", negative: "pill-rose" };
  return (
    <div className="px-5 pt-1 pb-5 bg-white/[0.015] border-t border-white/5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field icon={<PhoneIcon className="w-3 h-3" />} label="Caller">
          <div className="text-slate-100 text-sm">{sum.caller_name || "—"}</div>
          {sum.caller_phone && <div className="text-xs text-slate-500 font-mono mt-0.5">{sum.caller_phone}</div>}
        </Field>
        <Field icon={<Calendar className="w-3 h-3" />} label="Mentioned dates">
          <div className="text-slate-200 text-sm">{sum.mentioned_dates || "—"}</div>
        </Field>
        <Field label="Sentiment">
          {sum.sentiment ? <span className={sentimentCls[sum.sentiment] || "pill-slate"}>{sum.sentiment}</span> : <span className="text-slate-500 text-sm">—</span>}
        </Field>
      </div>

      {sum.transcript && (
        <div className="mt-4">
          <div className="stat-label mb-1.5">Full transcript</div>
          <pre className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-mono bg-black/25 rounded-md p-3 max-h-80 overflow-y-auto">{sum.transcript}</pre>
        </div>
      )}

      <div className="mt-4">
        <div className="stat-label mb-1.5">Summary</div>
        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{sum.summary}</p>
      </div>

      {keyPoints.length > 0 && (
        <div className="mt-4">
          <div className="stat-label mb-1.5">Key points</div>
          <ul className="space-y-1 text-sm text-slate-200">
            {keyPoints.map((p, i) => <li key={i} className="flex gap-2"><span className="text-accent-400">•</span><span>{p}</span></li>)}
          </ul>
        </div>
      )}

      {actionItems.length > 0 && (
        <div className="mt-4">
          <div className="stat-label mb-1.5">Action items</div>
          <ul className="space-y-1 text-sm text-slate-200">
            {actionItems.map((p, i) => <li key={i} className="flex gap-2"><span className="text-amber-400">→</span><span>{p}</span></li>)}
          </ul>
        </div>
      )}

      {topics.length > 0 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="stat-label">Topics</span>
          {topics.map((t) => <span key={t} className="pill-accent text-xs">{t}</span>)}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label mb-1 flex items-center gap-1.5">{icon}{label}</div>
      {children}
    </div>
  );
}
