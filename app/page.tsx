import KpiCard from "@/components/KpiCard";
import RevenueChart from "@/components/RevenueChart";
import ProjectStatusChart from "@/components/ProjectStatusChart";
import StatusBadge from "@/components/StatusBadge";
import { activity, invoices, projects } from "@/lib/data";

export default function DashboardPage() {
  const recentInvoices = invoices.slice(0, 4);
  const activeProjects = projects.filter((p) => p.status !== "done").slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back. Here&apos;s what&apos;s happening across your accounts.
          </p>
        </div>
        <button className="btn-primary">+ New project</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active clients" value="24" delta={8} hint="2 onboarding this week" />
        <KpiCard label="MRR" value="$15,290" delta={2.6} hint="$390 new this month" />
        <KpiCard label="Open invoices" value="$8,590" delta={-4.1} hint="1 overdue" />
        <KpiCard label="Avg response time" value="1h 12m" delta={12} hint="Target: under 2h" />
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
            <div className="font-semibold">Active projects</div>
            <a href="/projects" className="text-xs text-brand-600 hover:underline">View all</a>
          </div>
          <div className="space-y-4">
            {activeProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{p.name}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.client} · Due {p.due}</div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-slate-600 font-medium w-10 text-right">{p.progress}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Recent activity</div>
          </div>
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-xs font-semibold text-slate-600 shrink-0">
                  {a.who.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
                <div className="text-sm">
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-slate-500">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                  <div className="text-xs text-slate-400">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">Recent invoices</div>
          <a href="/invoices" className="text-xs text-brand-600 hover:underline">View all</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-3 font-medium">Invoice</th>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-3 font-medium">{i.id}</td>
                  <td className="py-3 pr-3 text-slate-600">{i.client}</td>
                  <td className="py-3 pr-3">${i.amount.toLocaleString()}</td>
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
