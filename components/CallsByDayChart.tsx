"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { day: string; calls: number };

export default function CallsByDayChart({
  data,
  total,
}: {
  data: Point[];
  total: number;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <div className="stat-label">Calls per day</div>
        <div className="text-xl font-semibold tracking-tight text-white">
          {total} last 7 days
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#0A0F1C",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
                color: "#E2E8F0",
              }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="calls" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill="#22D3EE" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
