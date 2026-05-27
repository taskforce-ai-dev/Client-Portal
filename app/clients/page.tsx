import StatusBadge from "@/components/StatusBadge";
import { Plus, Search } from "lucide-react";
import { clients } from "@/lib/data";

const gradients = [
  "from-accent-400 to-indigo-500",
  "from-violet-400 to-fuchsia-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-cyan-500",
];

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">My Clients</h1>
          <p className="text-sm text-slate-400 mt-1">
            {clients.length} clients · 4 active · 1 onboarding · 1 paused
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input placeholder="Search clients…" className="input-dark" />
          </div>
          <button className="btn-primary">
            <Plus className="w-4 h-4" /> New Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {clients.map((c, i) => {
          const initials = c.name.split(" ").map((s) => s[0]).join("");
          return (
            <div key={c.id} className="card p-5 hover:ring-1 hover:ring-accent-500/20 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[i % gradients.length]} text-ink-950 font-bold grid place-items-center text-base shadow-[0_8px_24px_-8px_rgba(34,211,238,0.4)]`}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="font-semibold text-white leading-tight">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.company}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="pill-accent">{c.plan}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <Stat label="MRR" value={`$${c.mrr.toLocaleString()}`} />
                <Stat label="Projects" value={String(((i * 7) % 4) + 1)} />
                <Stat label="Since" value={c.joined.slice(0, 7)} />
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex gap-2">
                <button className="btn-ghost flex-1 justify-center text-xs">Configure</button>
                <button className="btn-ghost flex-1 justify-center text-xs">Transcripts</button>
              </div>
            </div>
          );
        })}

        <button className="card p-5 border-dashed border border-white/10 bg-transparent ring-0 hover:bg-white/[0.02] transition grid place-items-center text-center min-h-[260px]">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 grid place-items-center mx-auto mb-3">
              <Plus className="w-5 h-5 text-accent-300" />
            </div>
            <div className="font-medium text-slate-200">Add another client</div>
            <div className="text-xs text-slate-500 mt-1">Starter · Growth · Enterprise</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
}
