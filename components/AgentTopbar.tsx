"use client";

import { Bell, ChevronDown, Search } from "lucide-react";
import { workspace } from "@/lib/data";

export default function AgentTopbar() {
  return (
    <header className="h-16 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl flex items-center justify-between px-6 lg:px-8 gap-4">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-ink-950 font-bold grid place-items-center text-xs">
            T
          </div>
          <span className="text-sm font-medium text-slate-200">{workspace.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-72 hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search calls, contacts, docs…"
            className="input-dark"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
        <button className="relative p-2 rounded-xl hover:bg-white/[0.06] text-slate-400">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_0_rgba(251,113,133,0.8)]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-indigo-500 text-ink-950 font-bold grid place-items-center text-xs">
          TC
        </div>
      </div>
    </header>
  );
}
