"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Gauge, TriangleAlert, X } from "lucide-react";
import type { AgentQuotaSnapshot } from "@/lib/billing";
import { moneyLKR } from "@/lib/billing";

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Shows once per (agent, period, status). "Got it" writes a localStorage
// key so the popup stays dismissed even after closing the tab / browser —
// it only returns when the billing period rolls over or the status flips
// (e.g. warn → exceeded). Brand-new month → new periodYm → new key → it
// pops again automatically.
export default function QuotaPopup({ agentId, agentName, quota }: { agentId: string; agentName?: string; quota: AgentQuotaSnapshot }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!quota.configured || quota.status === "ok") return;
    const key = `quota_popup_${agentId}_${quota.periodYm}_${quota.status}`;
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch { /* private mode — fall through and pop the modal */ }
    setOpen(true);
  }, [agentId, quota.configured, quota.status, quota.periodYm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    try { localStorage.setItem(`quota_popup_${agentId}_${quota.periodYm}_${quota.status}`, "1"); } catch {}
    setOpen(false);
  };

  if (!mounted || !open) return null;
  const exceeded = quota.status === "exceeded";
  const Icon = exceeded ? TriangleAlert : Gauge;
  const tint = exceeded ? "from-rose-500/30 to-rose-500/5 border-rose-500/30" : "from-amber-500/25 to-amber-500/5 border-amber-500/30";
  const iconWrap = exceeded ? "bg-rose-500/20 text-rose-200" : "bg-amber-500/20 text-amber-200";
  const titleClr = exceeded ? "text-rose-100" : "text-amber-100";
  const title = exceeded
    ? `Monthly ${fmtHm(quota.includedMinutes)} quota reached`
    : `${quota.percent}% of monthly ${fmtHm(quota.includedMinutes)} quota used`;
  const detail = exceeded
    ? `You've used ${fmtHm(quota.billableMinutes)} of ${fmtHm(quota.includedMinutes)} included calls for ${quota.periodLabel}. Overage so far: ${fmtHm(quota.overageMinutes)} — pay-as-you-go billing of ${moneyLKR(quota.overageCost)} applies until the new month resets.`
    : `${fmtHm(quota.billableMinutes)} of ${fmtHm(quota.includedMinutes)} for ${quota.periodLabel}. Calls after ${fmtHm(quota.includedMinutes)} bill at Rs. 3 / minute.`;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border bg-ink-950/95 ${tint} bg-gradient-to-b shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)]`}
      >
        <div className="flex items-start gap-3 p-5">
          <div className={`w-11 h-11 rounded-2xl ${iconWrap} grid place-items-center shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            {agentName && (
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400 mb-1">{agentName}</div>
            )}
            <div className={`text-sm font-semibold ${titleClr}`}>{title}</div>
            <p className="text-xs text-slate-300/90 mt-1.5 leading-relaxed">{detail}</p>
          </div>
          <button
            onClick={close}
            aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-100 p-1 -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button onClick={close} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.05]">
            Got it
          </button>
          <Link
            href={`/agents/${agentId}/notifications`}
            onClick={close}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] ring-1 ring-white/15 text-white hover:bg-white/[0.12]"
          >
            <Bell className="w-3 h-3" /> View notifications
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
