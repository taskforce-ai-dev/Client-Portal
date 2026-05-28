import KpiCard from "@/components/KpiCard";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import CallsByDayChart from "@/components/CallsByDayChart";
import SourceBadge from "@/components/SourceBadge";
import AutoRefresh from "@/components/AutoRefresh";
import TwilioNotice from "@/components/TwilioNotice";
import {
  bucketCallsByDay,
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
  getCalls,
} from "@/lib/twilio";

export const revalidate = 30;

export default async function AnalyticsPage() {
  const { calls, configured, error } = await getCalls(200);

  const { total, booked, convRate, avgDuration } = callStats(calls);

  const byDay = bucketCallsByDay(calls);
  const byHour = bucketCallsByHour(calls);
  const outcomes = bucketOutcomes(calls);

  const peak = byHour.reduce(
    (m, h) => (h.calls > m.calls ? h : m),
    byHour[0] ?? { hour: "—", calls: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
            <SourceBadge configured={configured} error={error} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Performance over the most recent {total} {total === 1 ? "call" : "calls"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalMs={30000} />
          <div className="flex items-center gap-2">
            {["24h", "7d", "30d", "90d"].map((p, i) => (
              <button
                key={p}
                className={
                  i === 1
                    ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
                    : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TwilioNotice configured={configured} error={error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total calls" value={String(total)} delta={0} hint="In window" />
        <KpiCard label="Bookings" value={String(booked)} delta={0} hint={`${convRate}% conv. rate`} />
        <KpiCard label="Avg duration" value={avgDuration} delta={0} hint="All outcomes" />
        <KpiCard label="Peak hour" value={peak.hour} delta={0} hint={`${peak.calls} calls / hour`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsByDayChart data={byDay} total={byDay.reduce((s, d) => s + d.calls, 0)} />
        </div>
        <OutcomeChart data={outcomes} />
      </div>

      <CallsChart data={byHour} title="Calls by hour" total={byHour.reduce((s, h) => s + h.calls, 0)} />
    </div>
  );
}
