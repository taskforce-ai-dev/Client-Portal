import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

export default function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: number;
  hint?: string;
}) {
  const up = delta >= 0;
  return (
    <div className="card p-5">
      <div className="stat-label">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
        <div
          className={clsx(
            "inline-flex items-center text-xs font-medium",
            up ? "text-emerald-400" : "text-rose-400"
          )}
        >
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(delta)}%
        </div>
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
