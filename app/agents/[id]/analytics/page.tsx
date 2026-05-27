import KpiCard from "@/components/KpiCard";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import CallsByDayChart from "@/components/CallsByDayChart";
import SourceBadge from "@/components/SourceBadge";
import {
  bucketCallsByDay,
  bucketCallsByHour,
  bucketOutcomes,
  getCalls,
} from "@/lib/twilio";

export const revalidate = 60;

export default async function AnalyticsPage() {
  const { calls, source } = await getCalls(200);

  const totalCalls = calls.length;
  const booked = calls.filter((c) => c.outcome === "Booked").length;
  const convRate = totalCalls ? Math.round((booked / totalCalls) * 1000) / 10 : 0;
  const avgSec = totalCalls
    ? Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / totalCalls)
    : 0;
  const avgDur = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, "0")}`;

  const byDay = bucketCallsByDay(calls);
  const byHour = bucketCallsByHour(calls);
  const outcomes = bucketOutcomes(calls);

  const peak = byHour.reduce((m, h) => (h.calls > m.calls ? h : m), byHour[0] ?? { hour: "—", calls: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
            <SourceBadge source={source} />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Performance over the most recent {Math.min(totalCalls, 200)} calls
          </p>
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total calls" value={String(totalCalls)} delta={0} hint="In window" />
        <KpiCard label="Bookings" value={String(booked)} delta={0} hint={`${convRate}% conv. rate`} />
        <KpiCard label="Avg duration" value={avgDur || "0:00"} delta={0} hint="All outcomes" />
        <KpiCard
          label="Peak hour"
          value={peak.hour}
          delta={0}
          hint={`${peak.calls} calls / hour`}
        />
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
