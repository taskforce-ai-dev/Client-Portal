import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText, TrendingUp, X } from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, listCallSummaries } from "@/lib/adminDb";
import { formatTs } from "@/lib/twilio";
import { computeStats, toConversion, type Conversion } from "@/lib/conversion";
import AutoRefresh from "@/components/AutoRefresh";
import type { CallSummary } from "@/components/CallLogTable";
import ViewTranscriptButton from "@/components/ViewTranscriptButton";

export const dynamic = "force-dynamic";

const RANGES: [string, string][] = [
  ["total", "Total"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  confirmed: "Confirmed",
  inquiry: "Inquiry",
  cancelled: "Cancelled",
  no_booking: "No booking",
  none: "Unclassified",
};

const STATUS_PILL: Record<string, string> = {
  confirmed: "pill-emerald",
  inquiry: "pill-accent",
  cancelled: "pill-rose",
  no_booking: "pill-slate",
  none: "pill-slate",
};

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
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
  const statusFilter = searchParams.status || "all";

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

  // Build counts for the status chip row.
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
      if (statusFilter !== "all") qs.set("status", statusFilter);
    } else if (key === "status") {
      if (value !== "all") qs.set("status", value); else qs.delete("status");
    }
    return qs.toString() ? `?${qs.toString()}` : "?";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Conversions</h1>
          <p className="text-sm text-slate-400 mt-1">
            {agent.name} · Booking outcomes from AI agent calls
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
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Real-intent calls"
          value={stats.inquiries.toLocaleString()}
          hint={`of ${stats.totalCalls.toLocaleString()} calls`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <Kpi
          label="Confirmed bookings"
          value={stats.confirmed.toLocaleString()}
          hint={`${stats.confirmed} confirmed`}
          tone="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <Kpi
          label="Conversion rate"
          value={`${stats.conversionPct}%`}
          hint="confirmed ÷ real-intent calls"
          tone={stats.conversionPct >= 25 ? "emerald" : stats.conversionPct >= 10 ? "amber" : "rose"}
        />
        <Kpi
          label="Revenue"
          value={moneyLKR(stats.totalRevenueLkr)}
          hint={stats.avgValueLkr ? `Avg ${moneyLKR(stats.avgValueLkr)}` : "No values posted yet"}
        />
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="stat-label mr-1">Status</span>
        {["all", "confirmed", "inquiry", "cancelled", "no_booking", "none"].map((s) => {
          const count = statusCounts[s] ?? 0;
          if (s !== "all" && count === 0) return null;
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

      {/* Conversion table */}
      <div className="card overflow-hidden">
        <ConversionsTable rows={filtered} emptyMessage={customMissing ? "Pick a start and end date." : "No conversions matched this filter."} />
      </div>

      <div className="text-[11px] text-slate-500">
        Booking fields (status, price, dates, room) come from the AI agent&apos;s call summary. Where the agent didn&apos;t set a status explicitly we infer it from the transcript using conservative keyword matching — explicit AI-set values always win.
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone?: "emerald" | "amber" | "rose"; icon?: React.ReactNode }) {
  const toneCls = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "rose" ? "text-rose-300" : "text-white";
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-400 stat-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function ConversionsTable({ rows, emptyMessage }: { rows: Conversion[]; emptyMessage: string }) {
  if (!rows.length) {
    return <div className="py-10 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }
  // We render the conversions table with the booking columns AND keep the
  // existing CallLogTable's "View transcript" modal by rendering a CallRow
  // → transcript inside each row via a side-by-side render. Simpler: embed
  // CallLogTable's modal trigger by reusing its row component shape.
  // For simplicity we inline a table with a transcript-modal-trigger
  // rendered via the embedded TranscriptCell component.
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
            <th className="py-2.5 px-4 font-medium">Caller</th>
            <th className="py-2.5 px-4 font-medium">When</th>
            <th className="py-2.5 px-4 font-medium">Status</th>
            <th className="py-2.5 px-4 font-medium text-right">Price</th>
            <th className="py-2.5 px-4 font-medium">Check-in → Check-out</th>
            <th className="py-2.5 px-4 font-medium text-right">Guests</th>
            <th className="py-2.5 px-4 font-medium">Room</th>
            <th className="py-2.5 px-4 font-medium">Confirmation #</th>
            <th className="py-2.5 px-4 font-medium text-right">Transcript</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <ConversionRow key={c.id} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversionRow({ c }: { c: Conversion }) {
  const pill = STATUS_PILL[c.status] ?? "pill-slate";
  const label = STATUS_LABELS[c.status] ?? c.status;
  const dateRange = (c.checkIn || c.checkOut)
    ? `${c.checkIn || "?"} → ${c.checkOut || "?"}`
    : (c.mentionedDates || "—");
  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] align-top">
      <td className="py-2.5 px-4 text-slate-100">
        {c.callerName}
        {c.callerPhone && <div className="text-[11px] text-slate-500 font-mono">{c.callerPhone}</div>}
      </td>
      <td className="py-2.5 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">{formatTs(c.occurredAt)}</td>
      <td className="py-2.5 px-4">
        <span className={pill}>{label}</span>
        {c.statusSource === "inferred" && (
          <div className="text-[10px] text-slate-600 mt-0.5" title="Status inferred from transcript keywords (no explicit AI field)">inferred</div>
        )}
      </td>
      <td className="py-2.5 px-4 text-slate-200 font-mono text-right whitespace-nowrap">{moneyLKR(c.valueLkr)}</td>
      <td className="py-2.5 px-4 text-slate-300 text-xs font-mono">{dateRange}</td>
      <td className="py-2.5 px-4 text-slate-300 text-right">{c.guests ?? "—"}</td>
      <td className="py-2.5 px-4 text-slate-300">{c.roomType || "—"}</td>
      <td className="py-2.5 px-4 text-slate-300 font-mono text-xs">{c.reference || "—"}</td>
      <td className="py-2.5 px-4 text-right">
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
