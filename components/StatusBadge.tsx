import clsx from "clsx";

const styles: Record<string, { cls: string; dot?: string }> = {
  active: { cls: "pill-emerald", dot: "bg-emerald-400" },
  onboarding: { cls: "pill-accent", dot: "bg-accent-400" },
  paused: { cls: "pill-slate", dot: "bg-slate-400" },
  "on-track": { cls: "pill-emerald", dot: "bg-emerald-400" },
  "at-risk": { cls: "pill-amber", dot: "bg-amber-400" },
  blocked: { cls: "pill-rose", dot: "bg-rose-400" },
  done: { cls: "pill-slate", dot: "bg-slate-400" },
  paid: { cls: "pill-emerald", dot: "bg-emerald-400" },
  pending: { cls: "pill-amber", dot: "bg-amber-400" },
  overdue: { cls: "pill-rose", dot: "bg-rose-400" },
  live: { cls: "pill-emerald", dot: "bg-emerald-400" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = styles[status] ?? { cls: "pill-slate", dot: "bg-slate-400" };
  return (
    <span className={clsx(s.cls, "capitalize")}>
      <span className={clsx("w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]", s.dot)} />
      {status.replace("-", " ")}
    </span>
  );
}
