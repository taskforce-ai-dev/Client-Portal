import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, findClientById } from "@/lib/adminDb";
import { BillingRange, fmtDurSec, getBillingSnapshot, moneyLKR } from "@/lib/billing";
import { formatTs } from "@/lib/twilio";
import PrintOnReady from "@/components/PrintOnReady";

export const dynamic = "force-dynamic";

const RANGE_LABEL: Record<string, string> = {
  total: "All-time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  custom: "Custom range",
};

export default async function ClientBillingReport({
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
  const client = await findClientById(agent.client_id);

  let range = (searchParams.range as BillingRange) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const snapshot = await getBillingSnapshot(agent, range, {
    customStart: searchParams.start,
    customEnd: searchParams.end,
  });

  const generatedAt = formatTs(new Date().toISOString());
  const periodLabel = snapshot.range === "total"
    ? "All-time"
    : `${snapshot.start} → ${snapshot.end}`;

  return (
    <>
      <style>{`
        :root { color-scheme: light; }
        html, body { background: #f5f5f7; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1d24; }
        .page { max-width: 880px; margin: 0 auto; padding: 28px 22px 80px; }
        .hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
        .brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
        .title { font-size: 22px; font-weight: 700; margin-top: 4px; color: #0f172a; }
        .meta { font-size: 11.5px; color: #475569; text-align: right; line-height: 1.7; }
        .meta span { color: #94a3b8; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
        .card h2 { margin: 0 0 12px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
        table.kv { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.kv th { width: 180px; text-align: left; color: #475569; font-weight: 500; padding: 6px 0; vertical-align: top; }
        table.kv td { padding: 6px 0; }
        .muted { color: #94a3b8; font-weight: 400; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #fafafa; }
        .kpi.hi { background: #0f172a; color: #fff; border-color: #0f172a; }
        .kpi .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
        .kpi.hi .lbl { color: #94a3b8; }
        .kpi .val { font-size: 18px; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums; }
        .note { margin-top: 14px; font-size: 11.5px; color: #64748b; line-height: 1.5; }
        .err { color: #b91c1c; margin-top: 6px; font-family: ui-monospace, monospace; font-size: 11px; }
        table.lines { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        table.lines th, table.lines td { border-bottom: 1px solid #eef2f7; padding: 6px 8px; text-align: left; }
        table.lines th { color: #475569; font-weight: 500; background: #f8fafc; }
        table.lines .r { text-align: right; }
        table.lines tr.totals td { border-top: 2px solid #0f172a; border-bottom: none; font-weight: 700; padding-top: 8px; }
        footer { display: flex; justify-content: space-between; margin-top: 18px; font-size: 11px; color: #94a3b8; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        @media print {
          html, body { background: #fff; }
          .page { padding: 0; max-width: none; }
          .card { box-shadow: none; break-inside: avoid; }
          table.lines tr { break-inside: avoid; }
        }
        @page { size: A4; margin: 16mm 14mm; }
      `}</style>
      <PrintOnReady />

      <div className="page">
        <header className="hdr">
          <div>
            <div className="brand">{client?.company || "Client"} · Sentinel</div>
            <div className="title">Agent billing report</div>
          </div>
          <div className="meta">
            <div><span>Generated</span> {generatedAt}</div>
            <div><span>Period</span> {RANGE_LABEL[range]} · {periodLabel}</div>
          </div>
        </header>

        <section className="card">
          <h2>Account</h2>
          <table className="kv">
            <tbody>
              <tr><th>Agent</th><td>{agent.name} <span className="muted">({agent.role || "Agent"} · {agent.type})</span></td></tr>
              <tr><th>Workspace</th><td>{client?.company ?? "—"}</td></tr>
              <tr><th>Channels</th><td>{agent.channels}</td></tr>
              <tr><th>Period</th><td>{RANGE_LABEL[range]} · <span className="mono">{periodLabel}</span></td></tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Summary</h2>
          <div className="grid4">
            <Kpi label="Total calls" value={String(snapshot.kpis.calls)} />
            <Kpi label="Billable calls" value={String(snapshot.kpis.billableCalls)} />
            <Kpi label="Total duration" value={fmtDurSec(snapshot.kpis.durationSec)} />
            <Kpi label="Billable minutes" value={String(snapshot.kpis.billableMinutes)} />
            <Kpi label="Per-minute rate" value={moneyLKR(snapshot.rate.perMinute)} />
            <Kpi label="Total cost" value={moneyLKR(snapshot.kpis.totalCost)} highlight />
            <Kpi label="Avg / billable call" value={moneyLKR(snapshot.kpis.avgCallCost)} />
            <Kpi label="Avg duration" value={fmtDurSec(snapshot.kpis.calls ? snapshot.kpis.durationSec / snapshot.kpis.calls : 0)} />
          </div>
          <div className="note">
            Billing is calculated per call, rounded up to the next whole minute, at {moneyLKR(snapshot.rate.perMinute)} per minute. Source: Twilio Calls API.
            {snapshot.error ? <div className="err">Twilio error: {snapshot.error}</div> : null}
          </div>
        </section>

        <section className="card">
          <h2>Call-level billing ({snapshot.lineItems.length} line items)</h2>
          {snapshot.lineItems.length === 0 ? (
            <p className="muted">No calls in this period.</p>
          ) : (
            <table className="lines">
              <thead>
                <tr>
                  <th>#</th><th>Call SID</th><th>Date</th><th>Direction</th><th>Outcome</th>
                  <th className="r">Duration</th><th className="r">Billable min</th><th className="r">Cost</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.lineItems.map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td className="mono">{l.id}</td>
                    <td>{formatTs(l.startedAtIso)}</td>
                    <td>{l.direction}</td>
                    <td>{l.outcome}</td>
                    <td className="r mono">{l.duration}</td>
                    <td className="r mono">{l.billableMinutes}</td>
                    <td className="r mono">{moneyLKR(l.cost)}</td>
                  </tr>
                ))}
                <tr className="totals">
                  <td colSpan={5} className="r">Totals</td>
                  <td className="r mono">{fmtDurSec(snapshot.kpis.durationSec)}</td>
                  <td className="r mono">{snapshot.kpis.billableMinutes}</td>
                  <td className="r mono">{moneyLKR(snapshot.kpis.totalCost)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <footer>
          <span>Sentinel · Confidential billing report</span>
          <span>
            <Link href={`/agents/${agent.id}/billing`}>← Back to billing</Link>
          </span>
        </footer>
      </div>
    </>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"kpi " + (highlight ? "hi" : "")}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}
