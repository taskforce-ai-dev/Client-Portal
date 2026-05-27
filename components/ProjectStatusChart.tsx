"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { projectsByStatus } from "@/lib/data";

const colors = ["#34D399", "#FBBF24", "#FB7185", "#94A3B8"];

export default function ProjectStatusChart() {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <div className="stat-label">Projects by status</div>
        <div className="text-xl font-semibold tracking-tight text-white">45 total</div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={projectsByStatus} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="status" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "#0A0F1C",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
                color: "#E2E8F0",
              }}
              labelStyle={{ color: "#94A3B8" }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {projectsByStatus.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
