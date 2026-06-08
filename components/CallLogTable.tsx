"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

export type CallSummary = {
  caller_name?: string | null;
  caller_phone?: string | null;
  summary: string;
  key_points?: string | null;
  action_items?: string | null;
  mentioned_dates?: string | null;
  sentiment?: string | null;
  topics?: string | null;
  transcript?: string | null;
};

export type CallRow = {
  id: string;
  caller: string;
  direction: string;
  startedAt: string;
  duration: string;
  outcome: string;
  summary: CallSummary | null;
};

const outcomePill: Record<string, string> = {
  Completed: "pill-emerald",
  "In progress": "pill-accent",
  Busy: "pill-amber",
  "No answer": "pill-slate",
  Failed: "pill-rose",
  Canceled: "pill-rose",
  "Handed over": "pill-violet",
  "Summary only": "pill-slate",
};

const sentimentPill: Record<string, string> = {
  positive: "pill-emerald",
  neutral: "pill-slate",
  negative: "pill-rose",
};

export default function CallLogTable({
  calls,
  emptyMessage = "No calls in this period.",
  maxHeight,
}: {
  calls: CallRow[];
  emptyMessage?: string;
  maxHeight?: number;
}) {
  const [modal, setModal] = useState<CallSummary | null>(null);
  const [mounted, setMounted] = useState(false);

  // Mark when we're hydrated on the client (so createPortal can run safely).
  useEffect(() => { setMounted(true); }, []);

  // Esc-to-close + body scroll lock when modal is open
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);

  if (!calls.length) {
    return <div className="py-10 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
              <th className="py-2.5 px-4 font-medium">Caller</th>
              <th className="py-2.5 px-4 font-medium">When</th>
              <th className="py-2.5 px-4 font-medium">Direction</th>
              <th className="py-2.5 px-4 font-medium">Duration</th>
              <th className="py-2.5 px-4 font-medium">Outcome</th>
              <th className="py-2.5 px-4 font-medium text-right">Transcript</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="py-2.5 px-4 text-slate-100">{c.summary?.caller_name || c.caller}</td>
                <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">{c.startedAt}</td>
                <td className="py-2.5 px-4 text-slate-300 capitalize">{c.direction}</td>
                <td className="py-2.5 px-4 text-slate-300 font-mono">{c.duration}</td>
                <td className="py-2.5 px-4">
                  <span className={outcomePill[c.outcome] ?? "pill-slate"}>{c.outcome}</span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {c.summary ? (
                    <button
                      type="button"
                      onClick={() => setModal(c.summary)}
                      className="text-accent-300 hover:text-accent-200 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <FileText className="w-3 h-3" /> View transcript
                    </button>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mounted && modal && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-3"
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Sticky header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
              <div className="min-w-0 flex-1">
                <div className="stat-label mb-1">Call transcript</div>
                <div className="text-base sm:text-lg font-semibold text-white">{modal.caller_name || "Caller"}</div>
                <div className="text-xs text-slate-400 mt-1 font-mono flex flex-wrap gap-x-3 gap-y-1">
                  {modal.caller_phone && <span>{modal.caller_phone}</span>}
                  {modal.mentioned_dates && <span>{modal.mentioned_dates}</span>}
                  {modal.sentiment && (
                    <span className={sentimentPill[modal.sentiment] || "pill-slate"}>{modal.sentiment}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-md px-3 py-2 text-sm font-medium text-slate-100 flex-shrink-0 transition-colors"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5" style={{ WebkitOverflowScrolling: "touch" }}>
              {modal.transcript ? (
                <>
                  <div className="stat-label mb-2">Full transcript</div>
                  <pre className="bg-black/30 border border-white/5 rounded-lg p-4 text-sm text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed mb-5">
                    {modal.transcript}
                  </pre>
                </>
              ) : (
                <div className="text-sm text-slate-400 bg-black/20 border border-white/5 rounded-lg p-3 mb-5">
                  No raw transcript was posted for this call — only the summary below.
                </div>
              )}
              <div className="stat-label mb-2">Summary</div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{modal.summary}</p>
              {modal.key_points && (
                <>
                  <div className="stat-label mb-2">Key points</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{modal.key_points}</div>
                </>
              )}
              {modal.action_items && (
                <>
                  <div className="stat-label mb-2">Action items</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{modal.action_items}</div>
                </>
              )}
              {modal.topics && (
                <div className="text-xs text-slate-400 bg-black/20 border border-white/5 rounded-md p-3">
                  <span className="stat-label mr-2">Topics</span>{modal.topics}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
