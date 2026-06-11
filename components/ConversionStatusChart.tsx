"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type StatusSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
};

// Donut + legend showing how each call-outcome bucket breaks down. Same
// visual language as components/OutcomeChart.tsx so the conversions
// dashboard feels consistent with the rest of the portal.
export default function ConversionStatusChart({ slices }: { slices: StatusSlice[] }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const pieData = slices.filter((s) => s.count > 0);

  return (
    <div className="card p-5 h-full">
      <div className="mb-4">
        <div className="stat-label">Status mix</div>
        <div className="text-xl font-semibold tracking-tight text-white">
          {total} {total === 1 ? "call" : "calls"}
        </div>
      </div>
      {pieData.length === 0 ? (
        <div className="h-40 grid place-items-center text-sm text-slate-500">No classified calls yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0A0F1C",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "#E2E8F0",
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const n = Number(value) || 0;
                    const pct = total ? Math.round((n / total) * 1000) / 10 : 0;
                    return [`${n} · ${pct}%`, String(name)];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2 text-sm">
            {slices.map((s) => {
              const pct = total ? Math.round((s.count / total) * 1000) / 10 : 0;
              const empty = s.count === 0;
              return (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className={`flex items-center gap-2 min-w-0 ${empty ? "text-slate-500" : "text-slate-300"}`}>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${empty ? "opacity-40" : ""}`}
                      style={{ background: s.color, boxShadow: empty ? "none" : `0 0 8px ${s.color}` }}
                    />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs tabular-nums ${empty ? "text-slate-600" : "text-slate-400"}`}>{s.count}</span>
                    <span className={`text-xs tabular-nums ${empty ? "text-slate-600" : "text-slate-300"} w-12 text-right`}>{pct}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
