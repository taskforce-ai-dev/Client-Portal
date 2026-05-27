import KpiCard from "@/components/KpiCard";
import RevenueChart from "@/components/RevenueChart";
import ProjectStatusChart from "@/components/ProjectStatusChart";
import StatusBadge from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { activity, invoices, projects } from "@/lib/data";

export default function DashboardPage() {
  const recentInvoices = invoices.slice(0, 4);
  const activeProjects = projects.filter((p) => p.status !== "done").slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            6 clients · 4 active · 1 onboarding · 1 paused
          </p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active clients" value="24" delta={8} hint="2 onboarding this week" />
        <KpiCard label="MRR" value="$15,290" delta={2.6} hint="$390 new this month" />
        <KpiCard label="Open invoices" value="$8,590" delta={-4.1} hint="1 overdue" />
        <KpiCard label="Avg response" value="1h 12m" delta={12} hint="Target: under 2h" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <ProjectStatusChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-white">Active projects</div>
            <a href="/projects" className="text-xs text-accent-300 hover:text-accent-200">View all →</a>
          </div>
          <div className="space-y-4">
            {activeProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-slate-100 truncate">{p.name}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.client} · Due {p.due}</div>
                  <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-gradient"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-slate-300 font-medium w-10 text-right">{p.progress}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-white">Recent activity</div>
          </div>
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] ring-1 ring-white/10 grid place-items-center text-xs font-semibold text-slate-200 shrink-0">
                  {a.who.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
                <div className="text-sm">
                  <span className="font-medium text-slate-200">{a.who}</span>{" "}
                  <span className="text-slate-500">{a.action}</span>{" "}
                  <span className="font-medium text-slate-200">{a.target}</span>
                  <div className="text-xs text-slate-500 mt-0.5">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-white">Recent invoices</div>
          <a href="/invoices" className="text-xs text-accent-300 hover:text-accent-200">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left stat-label border-b border-white/5">
                <th className="py-2 pr-3 font-medium">Invoice</th>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((i) => (
                <tr key={i.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="py-3 pr-3 font-medium text-slate-100">{i.id}</td>
                  <td className="py-3 pr-3 text-slate-300">{i.client}</td>
                  <td className="py-3 pr-3 text-slate-200">${i.amount.toLocaleString()}</td>
                  <td className="py-3 pr-3"><StatusBadge status={i.status} /></td>
                  <td className="py-3 pr-3 text-slate-500">{i.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
