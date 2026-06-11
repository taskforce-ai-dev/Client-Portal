import Link from "next/link";
import { redirect } from "next/navigation";
import { BedDouble, CheckCircle2, Coins, TrendingUp, Users } from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listCallSummaries } from "@/lib/adminDb";
import { formatTs } from "@/lib/twilio";
import {
  computeStats,
  formatStayRange,
  toConversion,
  type Conversion,
} from "@/lib/conversion";
import AutoRefresh from "@/components/AutoRefresh";
import type { CallSummary } from "@/components/CallLogTable";
import ViewTranscriptButton from "@/components/ViewTranscriptButton";
import ConversionStatusChart, { type StatusSlice } from "@/components/ConversionStatusChart";

export const dynamic = "force-dynamic";

const RANGES: [string, string][] = [
  ["total", "Total"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

const STATUS_LABELS: Record<string, string> = {
  all: "All bookings",
  confirmed: "Confirmed",
  inquiry: "Inquiries",
  cancelled: "Cancelled",
  no_booking: "Not interested",
  none: "Unclassified",
};

const STATUS_PILL: Record<string, string> = {
  confirmed: "pill-emerald",
  inquiry: "pill-accent",
  cancelled: "pill-rose",
  no_booking: "pill-slate",
  none: "pill-slate",
};

function moneyLKR(n: number | null) {
  if (n == null) return "—";
  return `Rs. ${n.toLocaleString()}`;
}

export default async function ConversionsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string; status?: string };
}) {
  const session = getClientSession();
  if (!session) redirect("/login");
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) redirect("/select");

  let range = (searchParams.range as string) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  // Default to Confirmed view per request. Override via ?status=...
  const statusFilter = searchParams.status || "confirmed";

  // Compute window
  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let end = now;
  let useFilter = true;
  let customMissing = false;
  if (range === "total") useFilter = false;
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    if (searchParams.start && searchParams.end) {
      start = new Date(searchParams.start + "T00:00:00Z");
      end = new Date(searchParams.end + "T23:59:59Z");
    } else customMissing = true;
  }

  const rawSummaries = useFilter
    ? await listCallSummaries(agent.id, { limit: 1000, startIso: start.toISOString(), endIso: new Date(end.getTime() + 86400000).toISOString() })
    : await listCallSummaries(agent.id, { limit: 1000 });

  const all: Conversion[] = rawSummaries.map(toConversion);
  const stats = computeStats(all);
  const filtered = statusFilter === "all" ? all : all.filter((c) => c.status === statusFilter);
  // Confirmed rows sorted by check-in date when available, then by call date desc.
  const sorted = [...filtered].sort((a, b) => {
    if (statusFilter === "confirmed" && a.checkIn && b.checkIn) return a.checkIn.localeCompare(b.checkIn);
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });

  const statusCounts: Record<string, number> = { all: all.length };
  for (const c of all) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;

  const qsBase = new URLSearchParams();
  if (range !== "total") qsBase.set("range", range);
  if (range === "custom" && searchParams.start) qsBase.set("start", searchParams.start);
  if (range === "custom" && searchParams.end) qsBase.set("end", searchParams.end);
  const chipHref = (key: string, value: string) => {
    const qs = new URLSearchParams(qsBase);
    if (key === "range") {
      if (value !== "total") qs.set("range", value); else qs.delete("range");
      if (statusFilter !== "confirmed") qs.set("status", statusFilter);
    } else if (key === "status") {
      if (value !== "confirmed") qs.set("status", value); else qs.delete("status");
    }
    return qs.toString() ? `?${qs.toString()}` : "?";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Conversions</h1>
          <p className="text-sm text-slate-400 mt-1">
            {agent.name} · Bookings & inquiries from AI agent calls
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AutoRefresh />
          <div className="flex items-center gap-2 flex-wrap">
            {RANGES.map(([k, label]) => (
              <Link
                key={k}
                href={chipHref("range", k)}
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
      </div>

      {range === "custom" && (
        <form method="GET" className="card p-3 flex items-end gap-2 flex-wrap">
          <input type="hidden" name="range" value="custom" />
          {statusFilter !== "confirmed" && <input type="hidden" name="status" value={statusFilter} />}
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
        <div className="card p-4 text-sm text-slate-400">Pick a start and end date to see conversions.</div>
      )}

      {/* KPI strip — hospitality-style */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Confirmed bookings"
          value={stats.confirmed.toLocaleString()}
          hint={stats.totalCalls ? `${stats.confirmed} of ${stats.totalCalls} calls` : undefined}
          tone="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <Kpi
          label="Revenue"
          value={moneyLKR(stats.totalRevenueLkr)}
          hint={stats.avgValueLkr ? `Avg ${moneyLKR(stats.avgValueLkr)} / booking` : "Awaiting price data"}
          icon={<Coins className="w-4 h-4" />}
        />
        <Kpi
          label="Room nights sold"
          value={stats.totalNights.toLocaleString()}
          hint={stats.confirmed ? `${stats.totalNights ? (stats.totalNights / stats.confirmed).toFixed(1) : "—"} avg per booking` : undefined}
          icon={<BedDouble className="w-4 h-4" />}
        />
        <Kpi
          label="Conversion rate"
          value={`${stats.conversionPct}%`}
          hint={`${stats.confirmed} / ${stats.realIntent} real-intent calls`}
          tone={stats.conversionPct >= 25 ? "emerald" : stats.conversionPct >= 10 ? "amber" : "rose"}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Status distribution chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ConversionStatusChart slices={buildStatusSlices(statusCounts)} />
        </div>
        <div className="lg:col-span-2 card p-5">
          <div className="stat-label mb-3">Funnel</div>
          <FunnelView confirmed={stats.confirmed} inquiries={statusCounts["inquiry"] ?? 0} cancelled={statusCounts["cancelled"] ?? 0} noBooking={statusCounts["no_booking"] ?? 0} unclassified={statusCounts["none"] ?? 0} totalCalls={stats.totalCalls} />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {["confirmed", "inquiry", "cancelled", "no_booking", "none", "all"].map((s) => {
          const count = statusCounts[s] ?? 0;
          if (s !== "all" && s !== "confirmed" && count === 0) return null;
          const active = statusFilter === s;
          return (
            <Link
              key={s}
              href={chipHref("status", s)}
              scroll={false}
              className={active
                ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
                : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
              }
            >
              {STATUS_LABELS[s] || s}{" "}
              <span className="text-slate-500 ml-0.5">{count}</span>
            </Link>
          );
        })}
      </div>

      {/* Booking table */}
      <div className="card overflow-hidden">
        <BookingTable rows={sorted} statusFilter={statusFilter} emptyMessage={
          customMissing
            ? "Pick a start and end date."
            : statusFilter === "confirmed"
              ? "No confirmed bookings in this period yet."
              : "No matching records."
        } />
      </div>

      <div className="text-[11px] text-slate-500">
        Booking details (price, dates, room, guests, confirmation #) are extracted from the AI agent&apos;s explicit fields when provided, otherwise pulled from the transcript using conservative pattern matching. Cells show <span className="text-slate-300">—</span> when a detail wasn&apos;t mentioned in the call.
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone?: "emerald" | "amber" | "rose"; icon?: React.ReactNode }) {
  const toneCls = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-white";
  const iconBg = tone === "emerald" ? "bg-emerald-500/10 text-emerald-300"
    : tone === "amber" ? "bg-amber-500/10 text-amber-300"
    : tone === "rose" ? "bg-rose-500/10 text-rose-300"
    : "bg-white/[0.04] text-slate-300";
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="stat-label">{label}</div>
        {icon && <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${iconBg}`}>{icon}</div>}
      </div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function BookingTable({ rows, statusFilter, emptyMessage }: { rows: Conversion[]; statusFilter: string; emptyMessage: string }) {
  if (!rows.length) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] grid place-items-center mx-auto mb-3">
          <CheckCircle2 className="w-5 h-5 text-slate-500" />
        </div>
        <div className="text-sm text-slate-300 font-medium">{emptyMessage}</div>
        {statusFilter === "confirmed" && (
          <div className="text-xs text-slate-500 mt-1">Inquiries and other call outcomes are available via the chips above.</div>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
            <th className="py-3 px-4 font-medium">Guest</th>
            <th className="py-3 px-4 font-medium">Call</th>
            <th className="py-3 px-4 font-medium">Status</th>
            <th className="py-3 px-4 font-medium">Stay</th>
            <th className="py-3 px-4 font-medium text-right">Nights</th>
            <th className="py-3 px-4 font-medium">Room</th>
            <th className="py-3 px-4 font-medium text-right">Guests</th>
            <th className="py-3 px-4 font-medium text-right">Total</th>
            <th className="py-3 px-4 font-medium">Confirmation #</th>
            <th className="py-3 px-4 font-medium text-right">Transcript</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => <BookingRow key={c.id} c={c} />)}
        </tbody>
      </table>
    </div>
  );
}

function BookingRow({ c }: { c: Conversion }) {
  const pill = STATUS_PILL[c.status] ?? "pill-slate";
  const label = STATUS_LABELS[c.status] ?? c.status;
  const stay = formatStayRange(c.checkIn, c.checkOut);
  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] align-top">
      <td className="py-3 px-4 text-slate-100">
        <div className="font-medium">{c.callerName}</div>
        {c.callerPhone && <div className="text-[11px] text-slate-500 font-mono mt-0.5">{c.callerPhone}</div>}
      </td>
      <td className="py-3 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">{formatTs(c.occurredAt)}</td>
      <td className="py-3 px-4">
        <span className={pill}>{label}</span>
        {c.statusSource === "inferred" && (
          <div className="text-[10px] text-slate-600 mt-0.5" title="Status inferred from transcript keywords">inferred</div>
        )}
      </td>
      <td className="py-3 px-4 text-slate-200 whitespace-nowrap">
        {stay}
        {c.mentionedDates && !c.checkIn && (
          <div className="text-[10px] text-slate-500 italic mt-0.5" title="Raw date phrase from transcript">&quot;{c.mentionedDates}&quot;</div>
        )}
      </td>
      <td className="py-3 px-4 text-slate-300 text-right font-mono">{c.nights ?? "—"}</td>
      <td className="py-3 px-4 text-slate-300">{c.roomType || "—"}</td>
      <td className="py-3 px-4 text-slate-300 text-right">
        {c.guests != null ? (
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3 h-3 text-slate-500" />
            <span>{c.guests}</span>
          </span>
        ) : "—"}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="text-slate-100 font-semibold font-mono">{moneyLKR(c.valueLkr)}</div>
        {c.valueLkr && c.nights && c.nights > 0 && (
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Rs. {Math.round(c.valueLkr / c.nights).toLocaleString()} / night</div>
        )}
      </td>
      <td className="py-3 px-4 text-slate-300 font-mono text-xs">{c.reference || "—"}</td>
      <td className="py-3 px-4 text-right">
        <ViewTranscriptButton summary={summaryToCallSummary(c.summary)} />
      </td>
    </tr>
  );
}

function summaryToCallSummary(s: import("@/lib/adminDb").DbCallSummary | null): CallSummary | null {
  if (!s) return null;
  return {
    caller_name: s.caller_name,
    caller_phone: s.caller_phone,
    summary: s.summary,
    key_points: s.key_points,
    action_items: s.action_items,
    mentioned_dates: s.mentioned_dates,
    sentiment: s.sentiment,
    topics: s.topics,
    transcript: s.transcript,
  };
}

function buildStatusSlices(counts: Record<string, number>): StatusSlice[] {
  // Order + colors picked to feel like a sales funnel:
  // green = won, cyan = open, amber = at risk, rose = lost, slate = unknown.
  return [
    { key: "confirmed", label: "Confirmed bookings", count: counts["confirmed"] ?? 0, color: "#34D399" },
    { key: "inquiry", label: "Inquiries", count: counts["inquiry"] ?? 0, color: "#22D3EE" },
    { key: "cancelled", label: "Cancelled", count: counts["cancelled"] ?? 0, color: "#FB7185" },
    { key: "no_booking", label: "Not interested", count: counts["no_booking"] ?? 0, color: "#94A3B8" },
    { key: "none", label: "Unclassified", count: counts["none"] ?? 0, color: "#475569" },
  ];
}

// Horizontal stacked bar funnel — left-to-right gradient from open
// pipeline → confirmed. Each segment shows its share of the total with
// a tooltip on hover. Matches the bar UX in CallsByDayChart etc.
function FunnelView({ confirmed, inquiries, cancelled, noBooking, unclassified, totalCalls }: {
  confirmed: number; inquiries: number; cancelled: number; noBooking: number; unclassified: number; totalCalls: number;
}) {
  const segs = [
    { label: "Confirmed", count: confirmed, color: "#34D399" },
    { label: "Inquiries", count: inquiries, color: "#22D3EE" },
    { label: "Cancelled", count: cancelled, color: "#FB7185" },
    { label: "Not interested", count: noBooking, color: "#94A3B8" },
    { label: "Unclassified", count: unclassified, color: "#475569" },
  ];
  const total = totalCalls || segs.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-10 rounded-lg overflow-hidden border border-white/5 bg-white/[0.02]">
        {segs.map((s) => {
          const pct = (s.count / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              className="flex items-center justify-center text-[10px] font-mono text-ink-950 font-semibold"
              style={{ width: `${pct}%`, background: s.color, minWidth: pct >= 4 ? undefined : "0" }}
              title={`${s.label}: ${s.count} (${pct.toFixed(1)}%)`}
            >
              {pct >= 8 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {segs.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div key={s.label} className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] uppercase tracking-[0.08em] text-slate-500 font-medium">{s.label}</span>
              </div>
              <div className="text-lg font-semibold text-white mt-1">{s.count}</div>
              <div className="text-[11px] text-slate-500 font-mono">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
