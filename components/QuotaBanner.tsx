"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, Gauge, X } from "lucide-react";
import type { AgentQuotaSnapshot } from "@/lib/billing";
import { moneyLKR } from "@/lib/billing";

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// Renders only when the quota is over a threshold. The close (X) button
// hides the banner for the remainder of the browser session AND scoped
// to the current (period, status) — a new month or a status flip from
// warn → exceeded brings it back automatically, even if the client
// dismissed an earlier instance.
export default function QuotaBanner({ quota, agentId }: { quota: AgentQuotaSnapshot; agentId?: string }) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // The dismissal key bundles agent + period + status so dismissing a
  // "warn" doesn't also dismiss the eventual "exceeded".
  const dismissKey = quota.configured && quota.status !== "ok"
    ? `quota_banner_${agentId || "_"}_${quota.periodYm}_${quota.status}`
    : null;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!dismissKey) { setDismissed(false); return; }
    try { setDismissed(sessionStorage.getItem(dismissKey) === "1"); } catch { setDismissed(false); }
  }, [dismissKey]);

  if (!quota.configured || quota.status === "ok") return null;
  if (mounted && dismissed) return null;

  const close = () => {
    if (dismissKey) {
      try { sessionStorage.setItem(dismissKey, "1"); } catch {}
    }
    setDismissed(true);
  };

  const usedLabel = fmtHm(quota.billableMinutes);
  const includedLabel = fmtHm(quota.includedMinutes);

  if (quota.status === "exceeded") {
    return (
      <div className="card p-4 border border-rose-500/30 bg-rose-500/[0.06] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 grid place-items-center shrink-0">
          <TriangleAlert className="w-4 h-4" />
        </div>
        <div className="text-sm min-w-0 flex-1">
          <div className="font-medium text-rose-200">
            You&apos;ve used your {includedLabel} of included calls for {quota.periodLabel}
          </div>
          <div className="text-xs text-rose-200/80 mt-0.5">
            Used {usedLabel} ({quota.percent}%) · Overage so far: {fmtHm(quota.overageMinutes)} ·
            Pay-as-you-go billing of {moneyLKR(quota.overageCost)} applies until the period resets.
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="text-rose-300/80 hover:text-rose-100 hover:bg-rose-500/15 rounded-md p-1 shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="card p-4 border border-amber-500/25 bg-amber-500/[0.05] flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 grid place-items-center shrink-0">
        <Gauge className="w-4 h-4" />
      </div>
      <div className="text-sm min-w-0 flex-1">
        <div className="font-medium text-amber-200">
          {quota.percent}% of your {includedLabel} call quota used for {quota.periodLabel}
        </div>
        <div className="text-xs text-amber-200/80 mt-0.5">
          {usedLabel} of {includedLabel}. Calls after {includedLabel} bill at Rs. 3 / minute.
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="text-amber-300/80 hover:text-amber-100 hover:bg-amber-500/15 rounded-md p-1 shrink-0 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
