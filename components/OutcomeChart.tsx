"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { outcomeBreakdown } from "@/lib/data";

export default function OutcomeChart() {
  const total = outcomeBreakdown.reduce((s, o) => s + o.count, 0);

  return (
    <div className="card p-5 h-full">
      <div className="mb-4">
        <div className="stat-label">Outcome breakdown</div>
        <div className="text-xl font-semibold tracking-tight text-white">{total} calls</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={outcomeBreakdown}
                dataKey="count"
                nameKey="outcome"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {outcomeBreakdown.map((o, i) => (
                  <Cell key={i} fill={o.color} />
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
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-2 text-sm">
          {outcomeBreakdown.map((o) => (
            <li key={o.outcome} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: o.color, boxShadow: `0 0 8px ${o.color}` }}
                />
                {o.outcome}
              </span>
              <span className="text-slate-400 text-xs">{o.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
