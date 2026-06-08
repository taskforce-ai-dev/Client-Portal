"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronDown, Search } from "lucide-react";

export type TopbarAgent = {
  id: string;
  name: string;
  role: string;
  gradient: string;
  initial: string;
};

export default function AgentTopbar({
  current,
  agents,
}: {
  current: TopbarAgent;
  agents: TopbarAgent[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const hasMany = agents.length > 1;

  return (
    <header className="h-16 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl flex items-center justify-between px-6 lg:px-8 gap-4">
      <div className="flex items-center gap-3" ref={wrapRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => hasMany && setOpen((v) => !v)}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.06] disabled:opacity-100"
            disabled={!hasMany}
            title={hasMany ? "Switch agent" : current.name}
          >
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${current.gradient} text-white font-bold grid place-items-center text-xs`}>
              {current.initial}
            </div>
            <span className="text-sm font-medium text-slate-200">{current.name}</span>
            {hasMany && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {open && hasMany && (
            <div className="absolute left-0 top-full mt-2 w-72 rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold border-b border-white/5">
                Switch agent
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {agents.map((a) => {
                  const active = a.id === current.id;
                  return (
                    <Link
                      key={a.id}
                      href={`/agents/${a.id}`}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 mx-1 rounded-lg ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.gradient} text-white font-bold grid place-items-center text-xs flex-shrink-0`}>
                        {a.initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{a.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{a.role}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-accent-300 flex-shrink-0" />}
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/select"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-xs text-accent-300 hover:text-accent-200 border-t border-white/5 text-center"
              >
                View all agents →
              </Link>
            </div>
          )}
        </div>
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
