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

const colors = ["#10b981", "#f59e0b", "#f43f5e", "#94a3b8"];

export default function ProjectStatusChart() {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <div className="text-sm text-slate-500">Projects by status</div>
        <div className="text-xl font-semibold tracking-tight">45 total</div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={projectsByStatus} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="status" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              cursor={{ fill: "#f1f5f9" }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
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
