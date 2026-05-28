const map: Record<string, string> = {
  active: "pill-emerald",
  trial: "pill-cyan",
  suspended: "pill-rose",
  live: "pill-emerald",
  paused: "pill-amber",
  draft: "pill-slate",
};

export default function StatusPill({ status }: { status: string }) {
  return <span className={map[status] ?? "pill-slate"}>{status}</span>;
}
