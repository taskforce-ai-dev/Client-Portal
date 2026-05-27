import clsx from "clsx";

const styles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  onboarding: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  paused: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  "on-track": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "at-risk": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  blocked: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  done: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  overdue: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("badge capitalize", styles[status] ?? "bg-slate-100 text-slate-600")}>
      {status.replace("-", " ")}
    </span>
  );
}
