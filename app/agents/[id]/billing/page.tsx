import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";
import { guardClientFeature } from "@/lib/featureAccess";
import { BillingRange, fmtDurSec, getBillingSnapshot, moneyLKR } from "@/lib/billing";

export const dynamic = "force-dynamic";

const RANGES: [BillingRange, string][] = [
  ["total", "Total"],
  ["today", "Today"],
  ["week", "7 days"],
  ["month", "30 days"],
  ["custom", "Custom"],
];

export default async function BillingPage({
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
  await guardClientFeature("billing", params.id);

  let range = (searchParams.range as BillingRange) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const customMissing = range === "custom" && (!searchParams.start || !searchParams.end);

  const snapshot = await getBillingSnapshot(agent, range, {
    customStart: searchParams.start,
    customEnd: searchParams.end,
  });

  const reportQs = range === "custom" && searchParams.start && searchParams.end
    ? `range=custom&start=${searchParams.start}&end=${searchParams.end}`
    : `range=${range}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Billing</h1>
          <p className="text-sm text-slate-400 mt-1">
            {agent.name} · Rs. {snapshot.rate.perMinute.toFixed(2)} per billable minute · per-call rounded up
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
          <a
            href={`/agents/${agent.id}/billing-report?${reportQs}`}
            target="_blank"
            rel="noopener"
            className="btn-primary text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </a>
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

      {!snapshot.configured && (
        <div className="card p-4 text-sm text-amber-300/90">
          Live call data isn&apos;t connected for this agent yet. Contact the TaskforceAI team to enable Twilio for this number.
        </div>
      )}
      {snapshot.error && (
        <div className="card p-4 text-sm text-rose-300/90 font-mono">Twilio error: {snapshot.error}</div>
      )}
      {customMissing && (
        <div className="card p-4 text-sm text-slate-400">Pick a start and end date to see custom-range billing.</div>
      )}

      <div className="card p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="stat-label">Period</div>
            <div className="text-base text-white font-mono mt-1">
              {snapshot.range === "total" ? "All-time" : (snapshot.start && snapshot.end ? `${snapshot.start} → ${snapshot.end}` : "—")}
            </div>
          </div>
          <div>
            <div className="stat-label">Rate</div>
            <div className="text-base text-white font-mono mt-1">{moneyLKR(snapshot.rate.perMinute)} / minute</div>
          </div>
          <div>
            <div className="stat-label">Billing method</div>
            <div className="text-sm text-slate-200 mt-1">Per call, rounded up to next minute</div>
          </div>
          <div>
            <div className="stat-label">Source</div>
            <div className="text-sm text-slate-200 mt-1">Twilio call records</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Total cost" value={moneyLKR(snapshot.kpis.totalCost)} highlight />
        <Kpi label="Billable minutes" value={String(snapshot.kpis.billableMinutes)} />
        <Kpi label="Billable calls" value={`${snapshot.kpis.billableCalls} / ${snapshot.kpis.calls}`} />
        <Kpi label="Avg per billable call" value={moneyLKR(snapshot.kpis.avgCallCost)} />
      </div>

      {snapshot.series.length > 0 && (
        <div className="card p-5">
          <div className="stat-label mb-3">{snapshot.seriesLabel}</div>
          <Bars data={snapshot.series} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Call-level billing</div>
          <div className="text-xs text-slate-400">{snapshot.lineItems.length} line items · Total {moneyLKR(snapshot.kpis.totalCost)}</div>
        </div>
        {snapshot.lineItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No billable calls in this period.</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left stat-label border-b border-white/5 bg-white/[0.02]">
                  <th className="py-2.5 px-4 font-medium">#</th>
                  <th className="py-2.5 px-4 font-medium">Call SID</th>
                  <th className="py-2.5 px-4 font-medium">When</th>
                  <th className="py-2.5 px-4 font-medium">Direction</th>
                  <th className="py-2.5 px-4 font-medium">Outcome</th>
                  <th className="py-2.5 px-4 font-medium text-right">Duration</th>
                  <th className="py-2.5 px-4 font-medium text-right">Bill. min</th>
                  <th className="py-2.5 px-4 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.lineItems.map((l, i) => (
                  <tr key={l.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-2 px-4 text-slate-500 font-mono">{i + 1}</td>
                    <td className="py-2 px-4 font-mono text-xs text-slate-400">{l.id}</td>
                    <td className="py-2 px-4 text-slate-500">{l.startedAt}</td>
                    <td className="py-2 px-4 text-slate-300 capitalize">{l.direction}</td>
                    <td className="py-2 px-4 text-slate-200">{l.outcome}</td>
                    <td className="py-2 px-4 text-right text-slate-300 font-mono">{l.duration}</td>
                    <td className="py-2 px-4 text-right text-slate-300 font-mono">{l.billableMinutes}</td>
                    <td className="py-2 px-4 text-right font-mono text-white">{moneyLKR(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Billing is read from Twilio call records and computed at Rs. {snapshot.rate.perMinute.toFixed(2)} / billable minute. Total duration this period: {fmtDurSec(snapshot.kpis.durationSec)}.
      </p>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"card p-4 " + (highlight ? "ring-1 ring-accent-500/30" : "")}>
      <div className="stat-label">{label}</div>
      <div className={"text-lg font-semibold mt-1 " + (highlight ? "text-accent-300" : "text-white")}>{value}</div>
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <div
            title={`${d.label}: ${moneyLKR(d.value)}`}
            style={{ height: `${Math.round((d.value / max) * 92) + 4}%` }}
            className="w-full max-w-[26px] rounded bg-gradient-to-b from-rose-500 to-amber-500"
          />
          <span className="text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
