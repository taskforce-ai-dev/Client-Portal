import { TriangleAlert, Gauge } from "lucide-react";
import type { AgentQuotaSnapshot } from "@/lib/billing";
import { moneyLKR } from "@/lib/billing";

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function QuotaBanner({ quota }: { quota: AgentQuotaSnapshot }) {
  if (!quota.configured || quota.status === "ok") return null;
  const usedLabel = fmtHm(quota.billableMinutes);
  const includedLabel = fmtHm(quota.includedMinutes);
  if (quota.status === "exceeded") {
    return (
      <div className="card p-4 border border-rose-500/30 bg-rose-500/[0.06] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-300 grid place-items-center shrink-0">
          <TriangleAlert className="w-4 h-4" />
        </div>
        <div className="text-sm min-w-0">
          <div className="font-medium text-rose-200">
            You&apos;ve used your {includedLabel} of included calls for {quota.periodLabel}
          </div>
          <div className="text-xs text-rose-200/80 mt-0.5">
            Used {usedLabel} ({quota.percent}%) · Overage so far: {fmtHm(quota.overageMinutes)} ·
            Pay-as-you-go billing of {moneyLKR(quota.overageCost)} applies until the new month resets.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-4 border border-amber-500/25 bg-amber-500/[0.05] flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 grid place-items-center shrink-0">
        <Gauge className="w-4 h-4" />
      </div>
      <div className="text-sm min-w-0">
        <div className="font-medium text-amber-200">
          {quota.percent}% of your monthly {includedLabel} call quota used
        </div>
        <div className="text-xs text-amber-200/80 mt-0.5">
          {usedLabel} of {includedLabel} for {quota.periodLabel}. Calls after {includedLabel} bill at Rs. 3 / minute.
        </div>
      </div>
    </div>
  );
}
