import Link from "next/link";
import { Bell, ChevronDown, Hexagon, Phone, Plus, Search } from "lucide-react";
import { agents, workspace } from "@/lib/data";

const channelIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  "Voice Call": Phone,
};

export default function SelectAgentPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl flex items-center justify-between px-6 lg:px-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-gradient grid place-items-center shadow-[0_0_24px_-4px_rgba(34,211,238,0.6)]">
              <Hexagon className="w-4 h-4 text-ink-950" strokeWidth={2.5} />
            </div>
            <div className="font-semibold tracking-tight text-white text-[15px]">
              Portal<span className="text-accent-400">.</span>
            </div>
          </div>
          <span className="text-slate-700">/</span>
          <button className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-ink-950 font-bold grid place-items-center text-xs">
              T
            </div>
            <span className="text-sm font-medium text-slate-200">{workspace.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <div className="pill-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_0_rgba(52,211,153,0.8)]" />
            {agents.filter((a) => a.status === "live").length} agent live
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-xl hover:bg-white/[0.06] text-slate-400">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_0_rgba(251,113,133,0.8)]" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center text-xs">
            TC
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Select an agent
              </h1>
              <p className="text-sm text-slate-400 mt-1.5">
                {agents.length} {agents.length === 1 ? "agent" : "agents"} in{" "}
                <span className="text-slate-200 font-medium">{workspace.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input placeholder="Search agents…" className="input-dark" />
              </div>
              <button className="btn-primary">
                <Plus className="w-4 h-4" /> New Agent
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="group card p-5 hover:ring-1 hover:ring-accent-500/30 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_24px_60px_-30px_rgba(34,211,238,0.4)] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.gradient} text-white font-bold grid place-items-center text-lg shadow-[0_8px_24px_-8px_rgba(168,85,247,0.5)]`}
                    >
                      {a.initial}
                    </div>
                    <div>
                      <div className="font-semibold text-white leading-tight text-lg">
                        {a.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{a.role}</div>
                    </div>
                  </div>
                  <span className="pill-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
                    {a.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.channels.map((ch) => {
                    const Icon = channelIcon[ch];
                    return (
                      <span key={ch} className="pill-accent">
                        {Icon && <Icon className="w-3 h-3" />} {ch}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Stat label="Calls today" value={String(a.callsToday)} />
                  <Stat label="Conv. rate" value={`${a.convRate}%`} />
                  <Stat label="Avg dur." value={a.avgDuration} />
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 text-xs text-accent-300 group-hover:text-accent-200 font-medium flex items-center justify-end">
                  Open dashboard →
                </div>
              </Link>
            ))}

            <button className="card p-5 border-dashed border border-white/10 bg-transparent ring-0 hover:bg-white/[0.02] transition grid place-items-center text-center min-h-[260px]">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 grid place-items-center mx-auto mb-3">
                  <Plus className="w-5 h-5 text-accent-300" />
                </div>
                <div className="font-medium text-slate-200">Add another agent</div>
                <div className="text-xs text-slate-500 mt-1">
                  Sales · Support · Booking · Cold Call
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>
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
