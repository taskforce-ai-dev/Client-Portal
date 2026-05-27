import StatusBadge from "@/components/StatusBadge";
import { projects } from "@/lib/data";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Track work across every account</p>
        </div>
        <button className="btn-primary">+ New project</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="card p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500 mt-1">{p.client}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Progress</span>
                <span className="font-medium text-slate-700">{p.progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Owner: <span className="text-slate-700 font-medium">{p.owner}</span></span>
              <span>Due {p.due}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
