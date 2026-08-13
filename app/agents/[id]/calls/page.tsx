import Link from "next/link";
import { redirect } from "next/navigation";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import CallLogTable, { CallRow } from "@/components/CallLogTable";
import { getClientSession } from "@/lib/clientAuth";
import {
  findAgentForClient,
  listCallSummaries,
} from "@/lib/adminDb";
import { getAllowedFeatures, guardClientFeature } from "@/lib/featureAccess";
import { formatTs } from "@/lib/twilio";
import { getAgentCalls } from "@/lib/callSource";
import { HANDOVER_OUTCOME, isHandoverCall } from "@/lib/handover";

export const dynamic = "force-dynamic";

const RANGES: [string, string][] = [
  ["total", "Total"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export default async function CallLogsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string; outcome?: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");
  await guardClientFeature("callLog", params.id);
  const allowedFeatures = await getAllowedFeatures();
  const transcriptsAllowed = allowedFeatures.has("transcripts");

  let range = (searchParams.range as string) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const customMissing = range === "custom" && (!searchParams.start || !searchParams.end);
  const outcomeFilter = searchParams.outcome || "all";

  // Compute window
  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  if (range === "total") { useDateFilter = false; }
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    if (searchParams.start && searchParams.end) {
      start = new Date(searchParams.start + "T00:00:00Z");
      endDate = new Date(searchParams.end + "T00:00:00Z");
    } else {
      useDateFilter = false;
    }
  }
  const endFilter = new Date(endDate.getTime() + 86400000);

  const [{ calls, configured, error }, summariesRaw] = await Promise.all([
    getAgentCalls(agent.id, {
      max: 1000,
      ...(useDateFilter ? { startDate: ymd(start), endDate: ymd(endFilter) } : {}),
    }),
    listCallSummaries(agent.id, { limit: 1000 }),
  ]);

  const summaryByCall = new Map<string, typeof summariesRaw[number]>();
  for (const s of summariesRaw) if (s.twilio_call_sid) summaryByCall.set(s.twilio_call_sid, s);

  const rows: CallRow[] = calls.map((c) => {
    const summary = summaryByCall.get(c.id) || null;
    const handover = c.outcome === "Completed" && summary
      ? isHandoverCall({ transcript: summary.transcript, summary: summary.summary, action_items: summary.action_items })
      : false;
    return {
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      duration: c.duration,
      outcome: handover ? HANDOVER_OUTCOME : c.outcome,
      summary,
    };
  });

  // Orphan summaries (no matching Twilio call) — show as "Summary only" rows
  const matchedCallSids = new Set(rows.map((r) => r.id));
  const filterStartMs = useDateFilter ? start.getTime() : 0;
  const filterEndMs = useDateFilter ? endDate.getTime() + 86400000 : Number.POSITIVE_INFINITY;
  const orphans = summariesRaw
    .filter((s) => !s.twilio_call_sid || !matchedCallSids.has(s.twilio_call_sid))
    .filter((s) => {
      if (!useDateFilter) return true;
      const t = new Date(s.occurred_at).getTime();
      return t >= filterStartMs && t < filterEndMs;
    })
    .map<CallRow>((s) => ({
      id: s.id,
      caller: s.caller_name || "—",
      direction: "—",
      startedAt: formatTs(s.occurred_at),
      duration: s.duration_sec ? `${Math.floor(s.duration_sec / 60)}:${String(s.duration_sec % 60).padStart(2, "0")}` : "—",
      outcome: "Summary only",
      summary: s as any,
    }));

  const allRowsUnfiltered = [...rows, ...orphans];
  // Outcome filter chips. "all" = no filter; others match the row's outcome
  // string literally (which already reflects Handed-over reclassification).
  const outcomeCounts: Record<string, number> = { all: allRowsUnfiltered.length };
  for (const r of allRowsUnfiltered) outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] ?? 0) + 1;
  const allRows = outcomeFilter === "all"
    ? allRowsUnfiltered
    : allRowsUnfiltered.filter((r) => r.outcome === outcomeFilter);
  const summarizedCount = allRows.filter((r) => r.summary).length;
  const qsBase = new URLSearchParams();
  if (range !== "total") qsBase.set("range", range);
  if (range === "custom" && searchParams.start) qsBase.set("start", searchParams.start);
  if (range === "custom" && searchParams.end) qsBase.set("end", searchParams.end);
  const outcomeHref = (val: string) => {
    const qs = new URLSearchParams(qsBase);
    if (val !== "all") qs.set("outcome", val);
    return qs.toString() ? `?${qs.toString()}` : "?";
  };
  const OUTCOME_CHIPS = ["all", "Completed", HANDOVER_OUTCOME, "No answer", "Busy", "Failed"]
    .filter((o) => o === "all" || (outcomeCounts[o] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Call Log</h1>
            <SourceBadge configured={configured} error={error} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {allRows.length} {allRows.length === 1 ? "call" : "calls"}
            {summarizedCount > 0 && ` · ${summarizedCount} with transcripts`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh />
          <div className="flex items-center gap-2">
            {RANGES.map(([k, label]) => (
              <Link
                key={k}
                href={`?range=${k}`}
                className={range === k
                  ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
                  : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
                }
                scroll={false}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {range === "custom" && (
        <form method="GET" className="card p-3 flex items-end gap-2 flex-wrap">
          <input type="hidden" name="range" value="custom" />
          <div>
            <div className="stat-label mb-1">From</div>
            <input type="date" name="start" defaultValue={searchParams.start || ""} className="input-dark" />
          </div>
          <div>
            <div className="stat-label mb-1">To</div>
            <input type="date" name="end" defaultValue={searchParams.end || ""} className="input-dark" />
          </div>
          <button type="submit" className="btn-primary">Apply</button>
        </form>
      )}

      <TwilioNotice configured={configured} error={error} />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="stat-label mr-1">Outcome</span>
        {OUTCOME_CHIPS.map((o) => (
          <Link
            key={o}
            href={outcomeHref(o)}
            scroll={false}
            className={outcomeFilter === o
              ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
              : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
            }
          >
            {o === "all" ? "All" : o}{" "}
            <span className="text-slate-500 ml-0.5">{outcomeCounts[o] ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <CallLogTable
          calls={allRows}
          emptyMessage={customMissing ? "Pick a start and end date to see calls." : "No calls in this period."}
          transcriptsAllowed={transcriptsAllowed}
        />
      </div>
    </div>
  );
}
