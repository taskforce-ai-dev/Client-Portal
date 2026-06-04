"use client";

import { useState } from "react";
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

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="card max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">{modal.caller_name || "Caller"}</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {modal.caller_phone || ""}
                  {modal.mentioned_dates ? ` · ${modal.mentioned_dates}` : ""}
                  {modal.sentiment ? (
                    <span className={"ml-2 " + (sentimentPill[modal.sentiment] || "pill-slate")}>{modal.sentiment}</span>
                  ) : null}
                </div>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {modal.transcript ? (
                <>
                  <div className="stat-label mb-1.5">Transcript</div>
                  <pre className="bg-black/25 rounded-md p-3 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed mb-4">
                    {modal.transcript}
                  </pre>
                </>
              ) : (
                <div className="text-xs text-slate-500 bg-black/15 rounded-md p-3 mb-4">
                  No raw transcript posted — only the summary below.
                </div>
              )}
              <div className="stat-label mb-1.5">Summary</div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-4">{modal.summary}</p>
              {modal.key_points && (
                <>
                  <div className="stat-label mb-1.5">Key points</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-4">{modal.key_points}</div>
                </>
              )}
              {modal.action_items && (
                <>
                  <div className="stat-label mb-1.5">Action items</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed mb-4">{modal.action_items}</div>
                </>
              )}
              {modal.topics && <div className="text-xs text-slate-500">Topics: {modal.topics}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
