import Link from "next/link";
import { redirect } from "next/navigation";
import KpiCard from "@/components/KpiCard";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import CallsByDayChart from "@/components/CallsByDayChart";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import {
  bucketCallsByDayRange,
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
  getAllCallsForSubaccount,
  isTwilioAuthConfigured,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

const RANGES = [
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
] as const;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  const sub = agent.twilio_subaccount_sid || process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID || "";
  const configured = isTwilioAuthConfigured() && !!sub;

  // Compute window from ?range (+ ?start/?end for custom)
  let range = (searchParams.range as string) || "month";
  if (!["today", "week", "month", "custom"].includes(range)) range = "month";
  const now = new Date();
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let endDate = now;
  let customMissing = false;
  if (range === "custom") {
    if (searchParams.start && searchParams.end) {
      start = new Date(searchParams.start + "T00:00:00Z");
      endDate = new Date(searchParams.end + "T00:00:00Z");
    } else {
      customMissing = true;
      start.setDate(now.getDate() - 29); // sensible default until user picks
    }
  } else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  const endFilter = new Date(endDate.getTime() + 86400000);

  const { calls, error } = configured && !customMissing
    ? await getAllCallsForSubaccount(sub, { max: 1000, startDate: ymd(start), endDate: ymd(endFilter) })
    : { calls: [] as any[], error: undefined as string | undefined };

  const { total, completed, completionRate, avgDuration } = callStats(calls);
  const byHour = bucketCallsByHour(calls);
  const byDay = bucketCallsByDayRange(calls, start.getTime(), endDate.getTime()).map((d) => ({ day: d.label, calls: d.value }));
  const outcomes = bucketOutcomes(calls);
  const peak = byHour.reduce((m, h) => (h.calls > m.calls ? h : m), byHour[0] ?? { hour: "—", calls: 0 });
  const periodSubtitle = range === "today" ? "today" : range === "custom"
    ? (customMissing ? "pick a range" : `${ymd(start)} → ${ymd(endDate)}`)
    : `last ${RANGES.find(([k]) => k === range)?.[1].toLowerCase()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
            <SourceBadge configured={configured} error={error} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {total} {total === 1 ? "call" : "calls"} · {periodSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalMs={30000} />
          <div className="flex items-center gap-2 flex-wrap">
            {RANGES.map(([k, label]) => (
              <Link
                key={k}
                href={`?range=${k}`}
                className={
                  range === k
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
            <input type="date" name="start" defaultValue={searchParams.start || ymd(start)} className="input-dark" />
          </div>
          <div>
            <div className="stat-label mb-1">To</div>
            <input type="date" name="end" defaultValue={searchParams.end || ymd(endDate)} className="input-dark" />
          </div>
          <button type="submit" className="btn-primary">Apply</button>
        </form>
      )}

      <TwilioNotice configured={configured} error={error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total calls" value={String(total)} delta={0} hint={periodSubtitle} />
        <KpiCard label="Completed" value={String(completed)} delta={0} hint={`${completionRate}% completion rate`} />
        <KpiCard label="Avg duration" value={avgDuration} delta={0} hint="All outcomes" />
        <KpiCard label="Peak hour" value={peak.hour} delta={0} hint={`${peak.calls} calls / hour`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsByDayChart data={byDay} total={byDay.reduce((s, d) => s + d.calls, 0)} subtitle={periodSubtitle} />
        </div>
        <OutcomeChart data={outcomes} />
      </div>

      {range === "today" && (
        <CallsChart data={byHour} title="Calls by hour" total={byHour.reduce((s, h) => s + h.calls, 0)} />
      )}
    </div>
  );
}
