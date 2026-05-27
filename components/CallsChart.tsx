"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { hour: string; calls: number };

export default function CallsChart({
  data,
  title = "Calls today",
  total,
  delta,
}: {
  data: Point[];
  title?: string;
  total: number;
  delta?: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="stat-label">{title}</div>
          <div className="text-xl font-semibold tracking-tight text-white">
            {total} {total === 1 ? "call" : "calls"}
          </div>
        </div>
        {typeof delta === "number" && (
          <div className={delta >= 0 ? "pill-emerald" : "pill-rose"}>
            {delta >= 0 ? "+" : ""}
            {delta}% vs yesterday
          </div>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="calls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#0A0F1C",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
                color: "#E2E8F0",
              }}
              labelStyle={{ color: "#94A3B8" }}
            />
            <Area type="monotone" dataKey="calls" stroke="#22D3EE" strokeWidth={2} fill="url(#calls)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
