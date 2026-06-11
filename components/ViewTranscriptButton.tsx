"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import type { CallSummary } from "./CallLogTable";

const sentimentPill: Record<string, string> = {
  positive: "pill-emerald",
  neutral: "pill-slate",
  negative: "pill-rose",
};

// Same transcript modal UX as CallLogTable but standalone — usable from
// any row in any table (Conversions, Call Log, future tables).
export default function ViewTranscriptButton({ summary, label = "View transcript", allowed = true }: { summary: CallSummary | null; label?: string; allowed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!summary || !allowed) {
    return <span className="text-slate-600 text-xs">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-accent-300 hover:text-accent-200 text-xs font-medium inline-flex items-center gap-1.5"
      >
        <FileText className="w-3 h-3" /> {label}
      </button>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-3"
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl bg-[#0d1117] border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
              <div className="min-w-0 flex-1">
                <div className="stat-label mb-1">Call transcript</div>
                <div className="text-base sm:text-lg font-semibold text-white">{summary.caller_name || "Caller"}</div>
                <div className="text-xs text-slate-400 mt-1 font-mono flex flex-wrap gap-x-3 gap-y-1">
                  {summary.caller_phone && <span>{summary.caller_phone}</span>}
                  {summary.mentioned_dates && <span>{summary.mentioned_dates}</span>}
                  {summary.sentiment && (
                    <span className={sentimentPill[summary.sentiment] || "pill-slate"}>{summary.sentiment}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-md px-3 py-2 text-sm font-medium text-slate-100 flex-shrink-0 transition-colors"
              >
                <X className="w-4 h-4" /> Close
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5" style={{ WebkitOverflowScrolling: "touch" }}>
              {summary.transcript ? (
                <>
                  <div className="stat-label mb-2">Full transcript</div>
                  <pre className="bg-black/30 border border-white/5 rounded-lg p-4 text-sm text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed mb-5">
                    {summary.transcript}
                  </pre>
                </>
              ) : (
                <div className="text-sm text-slate-400 bg-black/20 border border-white/5 rounded-lg p-3 mb-5">
                  No raw transcript was posted for this call — only the summary below.
                </div>
              )}
              <div className="stat-label mb-2">Summary</div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{summary.summary}</p>
              {summary.key_points && (
                <>
                  <div className="stat-label mb-2">Key points</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{summary.key_points}</div>
                </>
              )}
              {summary.action_items && (
                <>
                  <div className="stat-label mb-2">Action items</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-5">{summary.action_items}</div>
                </>
              )}
              {summary.topics && (
                <div className="text-xs text-slate-400 bg-black/20 border border-white/5 rounded-md p-3">
                  <span className="stat-label mr-2">Topics</span>{summary.topics}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
