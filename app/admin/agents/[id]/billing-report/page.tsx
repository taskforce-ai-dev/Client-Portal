import Link from "next/link";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, isDbConfigured } from "@/lib/adminDb";
import { getAllCallsForSubaccount, isTwilioAuthConfigured } from "@/lib/twilio";
import PrintOnReady from "@/components/PrintOnReady";

export const dynamic = "force-dynamic";

const RATE_PER_MINUTE = 3;
const CURRENCY = "Rs.";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function money(n: number) { return `${CURRENCY} ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDur(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${m}m ${r}s`;
  if (m) return `${m}m ${r}s`;
  return `${r}s`;
}

const RANGE_LABEL: Record<string, string> = {
  total: "All-time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  custom: "Custom range",
};

export default async function BillingReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  if (!isAuthed()) {
    return <Wrapper><p>You need to be signed in as an admin. <Link href="/admin/login">Sign in</Link></p></Wrapper>;
  }
  if (!isDbConfigured()) return <Wrapper><p>Database not connected.</p></Wrapper>;

  const agent = await findAgentById(params.id);
  if (!agent) return <Wrapper><p>Agent not found.</p></Wrapper>;
  const client = await findClientById(agent.client_id);
  const sub = agent.twilio_subaccount_sid || "";

  let range = (searchParams.range as string) || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const now = new Date();
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  if (range === "total") { useDateFilter = false; start.setDate(now.getDate() - 29); }
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom" && searchParams.start && searchParams.end) {
    start = new Date(searchParams.start + "T00:00:00Z");
    endDate = new Date(searchParams.end + "T00:00:00Z");
  } else if (range === "today") {
    // start = today
  }
  const endFilter = new Date(endDate.getTime() + 86400000);

  const { calls, error } = isTwilioAuthConfigured() && sub
    ? await getAllCallsForSubaccount(sub, {
        max: 1000,
        ...(useDateFilter ? { startDate: ymd(start), endDate: ymd(endFilter) } : {}),
      })
    : { calls: [] as any[], error: undefined as string | undefined };

  const lineItems = calls.map((c) => {
    const bm = c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0;
    return { ...c, billableMinutes: bm, cost: bm * RATE_PER_MINUTE };
  });
  const totalSec = lineItems.reduce((s, l) => s + l.durationSec, 0);
  const totalMin = lineItems.reduce((s, l) => s + l.billableMinutes, 0);
  const totalCost = totalMin * RATE_PER_MINUTE;
  const billableCalls = lineItems.filter((l) => l.billableMinutes > 0).length;

  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  const periodLabel = range === "total"
    ? "All-time"
    : `${ymd(start)} → ${ymd(endDate)}`;

  return (
    <Wrapper>
      <PrintOnReady />

      <div className="report">
        <header className="hdr">
          <div>
            <div className="brand">TaskforceAI · Sentinel</div>
            <div className="sub">Agent billing report</div>
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
              <tr><th>Client</th><td>{client?.company ?? "—"}{client?.email ? <span className="muted"> · {client.email}</span> : null}</td></tr>
              <tr><th>Channels</th><td>{agent.channels}</td></tr>
              <tr><th>Twilio subaccount</th><td className="mono">{sub || "—"}</td></tr>
              <tr><th>Period</th><td>{RANGE_LABEL[range]} · <span className="mono">{periodLabel}</span></td></tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Summary</h2>
          <div className="grid4">
            <Kpi label="Total calls" value={String(calls.length)} />
            <Kpi label="Billable calls" value={String(billableCalls)} />
            <Kpi label="Total duration" value={fmtDur(totalSec)} />
            <Kpi label="Billable minutes" value={String(totalMin)} />
            <Kpi label="Per-minute rate" value={money(RATE_PER_MINUTE)} />
            <Kpi label="Total cost" value={money(totalCost)} highlight />
            <Kpi label="Avg cost / billable call" value={money(billableCalls ? totalCost / billableCalls : 0)} />
            <Kpi label="Avg duration" value={fmtDur(calls.length ? totalSec / calls.length : 0)} />
          </div>
          <div className="note">
            Billing is calculated per call, rounded up to the next whole minute, at {money(RATE_PER_MINUTE)} per minute. Source: Twilio Calls API on subaccount above.
            {error ? <div className="err">Twilio error: {error}</div> : null}
          </div>
        </section>

        <section className="card">
          <h2>Call-level billing ({lineItems.length} line items)</h2>
          {lineItems.length === 0 ? (
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
                {lineItems.map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td className="mono small">{l.id}</td>
                    <td>{l.startedAtIso ? l.startedAtIso.slice(0, 19).replace("T", " ") : "—"}</td>
                    <td>{l.direction}</td>
                    <td>{l.outcome}</td>
                    <td className="r mono">{l.duration}</td>
                    <td className="r mono">{l.billableMinutes}</td>
                    <td className="r mono">{money(l.cost)}</td>
                  </tr>
                ))}
                <tr className="totals">
                  <td colSpan={5} className="r">Totals</td>
                  <td className="r mono">{fmtDur(totalSec)}</td>
                  <td className="r mono">{totalMin}</td>
                  <td className="r mono">{money(totalCost)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <footer>
          <span>Sentinel · Confidential billing report</span>
          <span>Subaccount {sub.slice(0, 12)}…</span>
        </footer>

      </div>
    </Wrapper>
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        :root { color-scheme: light; }
        html, body { background: #f5f5f7; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1d24; }
        .page { max-width: 880px; margin: 0 auto; padding: 28px 22px 80px; }
        .report .hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
        .report .brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
        .report .sub { font-size: 22px; font-weight: 700; margin-top: 4px; color: #0f172a; }
        .report .meta { font-size: 11.5px; color: #475569; text-align: right; line-height: 1.7; }
        .report .meta span { color: #94a3b8; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 16px; }
        .card h2 { margin: 0 0 12px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
        table.kv { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.kv th { width: 180px; text-align: left; color: #475569; font-weight: 500; padding: 6px 0; vertical-align: top; }
        table.kv td { padding: 6px 0; }
        .muted { color: #94a3b8; font-weight: 400; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .small { font-size: 11px; }
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
        .screen-only { display: block; }
        .actions { position: fixed; bottom: 18px; right: 18px; }
        .actions button { background: #0f172a; color: #fff; border: 0; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        @media print {
          html, body { background: #fff; }
          .page { padding: 0; max-width: none; }
          .screen-only { display: none; }
          .card { box-shadow: none; break-inside: avoid; }
          table.lines tr { break-inside: avoid; }
        }
        @page { size: A4; margin: 16mm 14mm; }
      `}</style>
      <div className="page">{children}</div>
    </>
  );
}
