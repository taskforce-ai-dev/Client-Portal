import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Gauge, TriangleAlert } from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import { formatTs } from "@/lib/twilio";
import { getAgentMonthlyQuota } from "@/lib/billing";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import {
  listAgentNotifications,
  type NotificationsRange,
  type QuotaNotification,
} from "@/lib/notifications";

function fmtHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const dynamic = "force-dynamic";

const RANGES: [NotificationsRange, string][] = [
  ["total", "All"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  let range = (searchParams.range as NotificationsRange) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const [{ items, customMissing }, quota] = await Promise.all([
    listAgentNotifications(agent.id, range, {
      customStart: searchParams.start,
      customEnd: searchParams.end,
    }),
    getAgentMonthlyQuota(agent),
  ]);

  const cadenceLabel = quota.cadence === "weekly"
    ? "Weekly"
    : quota.cadence === "none"
      ? "Lifetime (no reset)"
      : "Monthly";
  const statusLabel = quota.status === "exceeded"
    ? "Pay-as-you-go"
    : quota.status === "warn"
      ? "80% used"
      : "Within plan";
  const statusTone = quota.status === "exceeded"
    ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
    : quota.status === "warn"
      ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
      : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";

  return (
    <div className="space-y-6">
      <MarkNotificationsRead agentId={agent.id} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">
            {agent.name} · Quota reminders and account alerts
          </p>
        </div>
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

      {/* Read-only quota panel — clients can see the billing period &
          included minutes but cannot edit (only admins configure quota). */}
      {quota.configured && (
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="stat-label mb-1">Billing period</div>
              <div className="text-base font-semibold text-white">{quota.periodLabel}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                {quota.periodStart} → {quota.periodEnd}
                <span className="mx-2 text-slate-700">·</span>
                {cadenceLabel}
              </div>
            </div>
            <span className={`pill ${statusTone} ring-1`}>{statusLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div>
              <div className="stat-label">Included</div>
              <div className="text-sm font-semibold text-white mt-0.5">{fmtHm(quota.includedMinutes)}</div>
              <div className="text-[11px] text-slate-500">{quota.includedMinutes.toLocaleString()} min</div>
            </div>
            <div>
              <div className="stat-label">Used so far</div>
              <div className="text-sm font-semibold text-white mt-0.5">{fmtHm(quota.billableMinutes)}</div>
              <div className="text-[11px] text-slate-500">{quota.billableMinutes.toLocaleString()} min · {quota.percent}%</div>
            </div>
            <div>
              <div className="stat-label">Remaining</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {fmtHm(Math.max(0, quota.includedMinutes - quota.billableMinutes))}
              </div>
              <div className="text-[11px] text-slate-500">Resets {quota.cadence === "none" ? "never" : quota.periodEnd}</div>
            </div>
            <div>
              <div className="stat-label">Overage</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {quota.overageMinutes ? fmtHm(quota.overageMinutes) : "—"}
              </div>
              <div className="text-[11px] text-slate-500">
                {quota.overageCost ? `Rs. ${quota.overageCost.toLocaleString()}` : "Within plan"}
              </div>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-4">
            <div
              className={`h-full rounded-full ${
                quota.status === "exceeded"
                  ? "bg-gradient-to-r from-rose-500 to-amber-500"
                  : quota.status === "warn"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : "bg-accent-gradient"
              }`}
              style={{ width: `${Math.min(100, quota.percent)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Billing period &amp; included minutes are configured by your account admin. Contact them to change.
          </div>
        </div>
      )}

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
        <div className="card p-4 text-sm text-slate-400">Pick a start and end date to see notifications in a custom range.</div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="w-8 h-8 mx-auto text-slate-600 mb-3" />
          <div className="text-sm text-slate-300 font-medium">You&apos;re all caught up</div>
          <div className="text-xs text-slate-500 mt-1">No notifications in this period.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationCard({ n }: { n: QuotaNotification }) {
  const isExceeded = n.kind === "exceeded";
  const Icon = isExceeded ? TriangleAlert : Gauge;
  const box = isExceeded
    ? "border-rose-500/30 bg-rose-500/[0.06]"
    : "border-amber-500/25 bg-amber-500/[0.05]";
  const iconWrap = isExceeded
    ? "bg-rose-500/15 text-rose-300"
    : "bg-amber-500/15 text-amber-300";
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
