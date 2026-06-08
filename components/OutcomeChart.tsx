"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ExternalLink, X } from "lucide-react";
import CallLogTable, { type CallRow } from "./CallLogTable";

export type OutcomeSlice = {
  outcome: string;
  count: number;
  color: string;
  calls: CallRow[];
};

export default function OutcomeChart({ data }: { data: OutcomeSlice[] }) {
  const total = data.reduce((s, o) => s + o.count, 0);
  const [openOutcome, setOpenOutcome] = useState<OutcomeSlice | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!openOutcome) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenOutcome(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [openOutcome]);

  return (
    <div className="card p-5 h-full">
      <div className="mb-4">
        <div className="stat-label">Outcome breakdown</div>
        <div className="text-xl font-semibold tracking-tight text-white">
          {total} {total === 1 ? "call" : "calls"}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="h-40 grid place-items-center text-sm text-slate-500">No calls yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="outcome"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((o, i) => (
                    <Cell key={i} fill={o.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#0A0F1C",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "#E2E8F0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2 text-sm">
            {data.map((o) => (
              <li key={o.outcome} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-300 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: o.color, boxShadow: `0 0 8px ${o.color}` }}
                  />
                  <span className="truncate">{o.outcome}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-400 text-xs tabular-nums">{o.count}</span>
                  <button
                    type="button"
                    onClick={() => setOpenOutcome(o)}
                    disabled={o.calls.length === 0}
                    className="text-[11px] font-medium text-accent-300 hover:text-accent-200 inline-flex items-center gap-1 disabled:text-slate-600 disabled:cursor-not-allowed"
                  >
                    See full list <ExternalLink className="w-3 h-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mounted && openOutcome && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-3"
          onClick={() => setOpenOutcome(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
              <div className="min-w-0 flex-1">
                <div className="stat-label mb-1">Call list · {openOutcome.outcome}</div>
                <div className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: openOutcome.color, boxShadow: `0 0 10px ${openOutcome.color}` }}
                  />
                  {openOutcome.count} {openOutcome.count === 1 ? "call" : "calls"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Click any row&apos;s <span className="text-accent-300">View transcript</span> to read the full call.
                </div>
              </div>
              <button
                onClick={() => setOpenOutcome(null)}
                aria-label="Close"
                className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-md px-3 py-2 text-sm font-medium text-slate-100 flex-shrink-0 transition-colors"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CallLogTable
                calls={openOutcome.calls}
                emptyMessage={`No ${openOutcome.outcome.toLowerCase()} calls in this period.`}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
