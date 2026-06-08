import Link from "next/link";
import { Bell, Gauge, TriangleAlert } from "lucide-react";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, isDbConfigured } from "@/lib/adminDb";
import { formatTs } from "@/lib/twilio";
import { getAgentMonthlyQuota } from "@/lib/billing";
import {
  listAgentNotifications,
  type NotificationsRange,
  type QuotaNotification,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const RANGES: [NotificationsRange, string][] = [
  ["total", "All"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

export default async function AdminAgentNotificationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  if (!isAuthed()) {
    return <Wrapper><p className="text-sm text-slate-300">Sign in as an admin. <Link className="text-accent-300" href="/admin/login">Sign in →</Link></p></Wrapper>;
  }
  if (!isDbConfigured()) return <Wrapper><p className="text-sm text-slate-300">Database not connected.</p></Wrapper>;

  const agent = await findAgentById(params.id);
  if (!agent) return <Wrapper><p className="text-sm text-slate-300">Agent not found.</p></Wrapper>;
  const client = await findClientById(agent.client_id);

  let range = (searchParams.range as NotificationsRange) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const [{ items, customMissing }, quota] = await Promise.all([
    listAgentNotifications(agent.id, range, {
      customStart: searchParams.start,
      customEnd: searchParams.end,
    }),
    getAgentMonthlyQuota(agent),
  ]);

  return (
    <Wrapper>
      <div className="space-y-6">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            <Link href="/admin/records" className="hover:text-slate-300">Admin</Link>
            {" "}/{" "}
            <span className="text-slate-400">Agent · {agent.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">
            {client?.company || "—"} · {agent.name} ({agent.id})
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Status" value={statusLabel(quota.status)} hint={`${quota.percent}% of monthly 40h`} />
          <Kpi label="Used this month" value={fmtHm(quota.billableMinutes)} hint={quota.periodLabel} />
          <Kpi label="Included" value={fmtHm(quota.includedMinutes)} hint="Per calendar month" />
          <Kpi
            label="Overage so far"
            value={quota.overageMinutes ? fmtHm(quota.overageMinutes) : "—"}
            hint={quota.overageCost ? `Rs. ${quota.overageCost.toLocaleString()}` : "Within plan"}
          />
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-400">Filter by period</div>
          <div className="flex items-center gap-2 flex-wrap">
            {RANGES.map(([k, label]) => (
              <Link
                key={k}
                href={`?range=${k}`}
                className={range === k
                  ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
                  : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
                }
                scroll={false}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {range === "custom" && (
          <form method="GET" className="card p-3 flex items-end gap-2 flex-wrap">
            <input type="hidden" name="range" value="custom" />
            <div>
              <div className="stat-label mb-1">From</div>
              <input type="date" name="start" defaultValue={searchParams.start || ""} className="input-dark" />
            </div>
            <div>
              <div className="stat-label mb-1">To</div>
              <input type="date" name="end" defaultValue={searchParams.end || ""} className="input-dark" />
            </div>
            <button type="submit" className="btn-primary">Apply</button>
          </form>
        )}

        {customMissing && (
          <div className="card p-4 text-sm text-slate-400">Pick a start and end date to filter by a custom range.</div>
        )}

        {items.length === 0 ? (
          <div className="card p-10 text-center">
            <Bell className="w-8 h-8 mx-auto text-slate-600 mb-3" />
            <div className="text-sm text-slate-300 font-medium">No notifications</div>
            <div className="text-xs text-slate-500 mt-1">Nothing has been delivered for this agent in this range.</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <Card key={n.id} n={n} />
            ))}
          </ul>
        )}
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function statusLabel(s: "ok" | "warn" | "exceeded") {
  return s === "exceeded" ? "Pay-as-you-go" : s === "warn" ? "80% used" : "Within plan";
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <div className="stat-label">{label}</div>
      <div className="text-base font-semibold text-white mt-1">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Card({ n }: { n: QuotaNotification }) {
  const isExceeded = n.kind === "exceeded";
  const Icon = isExceeded ? TriangleAlert : Gauge;
  const box = isExceeded ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-amber-500/25 bg-amber-500/[0.05]";
  const iconWrap = isExceeded ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300";
  const titleClr = isExceeded ? "text-rose-200" : "text-amber-200";
  const title = isExceeded ? "Monthly 40h quota reached" : "80% of monthly quota used";
  return (
    <li className={`card p-4 border ${box} flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${iconWrap} grid place-items-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className={`font-medium text-sm ${titleClr}`}>{title}</div>
          <div className="text-[11px] text-slate-500 font-mono">{formatTs(n.occurredAt)}</div>
        </div>
        <div className="text-sm text-slate-200/90 mt-1">{n.summary}</div>
      </div>
    </li>
  );
}
