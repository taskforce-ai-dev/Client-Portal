import StatusBadge from "@/components/StatusBadge";
import { Plus } from "lucide-react";
import { projects } from "@/lib/data";

const gradients = [
  "from-accent-400 to-indigo-500",
  "from-violet-400 to-fuchsia-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Projects</h1>
          <p className="text-sm text-slate-400 mt-1">Track work across every account</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p, i) => (
          <div key={p.id} className="card p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradients[i % gradients.length]} grid place-items-center text-ink-950`}
                >
                  <span className="text-sm font-bold">{p.name[0]}</span>
                </div>
                <div>
                  <div className="font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.client}</div>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="stat-label">Progress</span>
                <span className="font-medium text-slate-200">{p.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${p.progress}%` }} />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500">Owner: <span className="text-slate-200 font-medium">{p.owner}</span></span>
              <span className="text-slate-500">Due {p.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
