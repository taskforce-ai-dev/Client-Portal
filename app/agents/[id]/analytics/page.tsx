import KpiCard from "@/components/KpiCard";
import CallsChart from "@/components/CallsChart";
import OutcomeChart from "@/components/OutcomeChart";
import CallsByDayChart from "@/components/CallsByDayChart";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Performance trends over the last 7 days
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
        <KpiCard label="Total calls" value="100" delta={18} hint="vs previous 7d" />
        <KpiCard label="Bookings" value="38" delta={22} hint="71.4% conv. rate" />
        <KpiCard label="Avg duration" value="2:48" delta={-3} hint="Down from 2:53" />
        <KpiCard label="Peak hour" value="6 – 7 PM" delta={0} hint="8 calls / hour" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CallsByDayChart />
        </div>
        <OutcomeChart />
      </div>

      <CallsChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-semibold text-white mb-4">Top intents</div>
          <ul className="space-y-3">
            {[
              { label: "Check availability", count: 42, color: "#22D3EE" },
              { label: "Pricing & seasons", count: 28, color: "#A78BFA" },
              { label: "Cancellation / reschedule", count: 13, color: "#FBBF24" },
              { label: "Amenities & pets", count: 11, color: "#34D399" },
              { label: "Directions / parking", count: 6, color: "#FB7185" },
            ].map((row) => {
              const pct = Math.round((row.count / 42) * 100);
              return (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-slate-400 text-xs">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: row.color, boxShadow: `0 0 8px ${row.color}55` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <div className="font-semibold text-white mb-4">Conversion funnel</div>
          <ul className="space-y-3">
            {[
              { stage: "Calls answered", count: 88, pct: 88 },
              { stage: "Qualified", count: 64, pct: 73 },
              { stage: "Quote given", count: 52, pct: 81 },
              { stage: "Booked", count: 38, pct: 73 },
            ].map((row, i) => (
              <li key={row.stage} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-white/[0.04] ring-1 ring-white/10 grid place-items-center text-[10px] font-bold text-slate-400">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-200 font-medium">{row.stage}</span>
                    <span className="text-slate-500 text-xs">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-gradient"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
