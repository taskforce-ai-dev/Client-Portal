import Link from "next/link";
import { Bell, Gauge, TriangleAlert } from "lucide-react";
import { isAuthed } from "@/lib/adminAuth";
import { ensureSeed, getSql, isDbConfigured } from "@/lib/adminDb";
import { formatTs } from "@/lib/twilio";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  action: string;
  target: string | null;
  summary: string;
  occurred_at: string;
};

type AgentLite = { id: string; name: string; client_id: string };
type ClientLite = { id: string; company: string };

export default async function AdminNotificationsIndex({
  searchParams,
}: {
  searchParams: { agent?: string; kind?: string };
}) {
  if (!isAuthed()) {
    return <Wrapper><p className="text-sm text-slate-300">Sign in as an admin. <Link className="text-cyan-300" href="/admin/login">Sign in →</Link></p></Wrapper>;
  }
  if (!isDbConfigured()) return <Wrapper><p className="text-sm text-slate-300">Database not connected.</p></Wrapper>;

  const sql = getSql()!;
  await ensureSeed(sql);

  const kind = searchParams.kind === "warn" || searchParams.kind === "exceeded" ? searchParams.kind : "all";
  const agentFilter = searchParams.agent || "all";

  const rows = (await sql`SELECT id, action, target, summary, occurred_at
                          FROM sentinel_audit
                          WHERE action LIKE 'client.quota.%'
                          ORDER BY occurred_at DESC
                          LIMIT 500`) as Row[];

  const agents = (await sql`SELECT id, name, client_id FROM sentinel_agent ORDER BY name`) as AgentLite[];
  const clients = (await sql`SELECT id, company FROM sentinel_client`) as ClientLite[];
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const filtered = rows.filter((r) => {
    if (kind !== "all") {
      const want = kind === "exceeded" ? "client.quota.exceeded" : "client.quota.warn";
      if (r.action !== want) return false;
    }
    if (agentFilter !== "all" && r.target !== agentFilter) return false;
    return true;
  });

  const totalCounts = {
    all: rows.length,
    warn: rows.filter((r) => r.action === "client.quota.warn").length,
    exceeded: rows.filter((r) => r.action === "client.quota.exceeded").length,
  };

  return (
    <Wrapper>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            <Link href="/admin/records" className="hover:text-slate-300">Admin</Link> {" / "} <span className="text-slate-400">Notifications</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">All quota-threshold events delivered to clients.</p>
        </div>
        <Link href="/admin/records" className="text-xs text-cyan-300 hover:text-cyan-200">← Admin records</Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="stat-label mr-1">Kind</span>
        <KindChip current={kind} value="all" label={`All (${totalCounts.all})`} agent={agentFilter} />
        <KindChip current={kind} value="warn" label={`80% warn (${totalCounts.warn})`} agent={agentFilter} />
        <KindChip current={kind} value="exceeded" label={`Exceeded (${totalCounts.exceeded})`} agent={agentFilter} />
      </div>

      <form method="GET" className="flex items-end gap-2 flex-wrap mb-5">
        <input type="hidden" name="kind" value={kind} />
        <div>
          <div className="stat-label mb-1">Agent</div>
          <select
            name="agent"
            defaultValue={agentFilter}
            className="input-dark"
          >
            <option value="all">All agents</option>
            {agents.map((a) => {
              const cli = clientById.get(a.client_id);
              return (
                <option key={a.id} value={a.id}>
                  {a.name} {cli?.company ? `· ${cli.company}` : ""}
                </option>
              );
            })}
          </select>
        </div>
        <button type="submit" className="btn-primary">Apply</button>
      </form>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="w-8 h-8 mx-auto text-slate-600 mb-3" />
          <div className="text-sm text-slate-300 font-medium">No notifications match this filter.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const agent = r.target ? agentById.get(r.target) : null;
            const client = agent ? clientById.get(agent.client_id) : null;
            return <Card key={r.id} row={r} agentName={agent?.name} clientCompany={client?.company} agentId={agent?.id} />;
          })}
        </ul>
      )}
    </Wrapper>
  );
}

function KindChip({ current, value, label, agent }: { current: string; value: string; label: string; agent: string }) {
  const qs = new URLSearchParams();
  if (value !== "all") qs.set("kind", value);
  if (agent !== "all") qs.set("agent", agent);
  const href = qs.toString() ? `?${qs.toString()}` : "?";
  const active = current === value;
  return (
    <Link
      href={href}
      className={active
        ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] ring-1 ring-white/10 text-white"
        : "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.03]"
      }
    >
      {label}
    </Link>
  );
}

function Card({ row, agentName, clientCompany, agentId }: { row: Row; agentName?: string; clientCompany?: string; agentId?: string }) {
  const exceeded = row.action === "client.quota.exceeded";
  const Icon = exceeded ? TriangleAlert : Gauge;
  const box = exceeded ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-amber-500/25 bg-amber-500/[0.05]";
  const iconWrap = exceeded ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300";
  const titleClr = exceeded ? "text-rose-200" : "text-amber-200";
  const title = exceeded ? "Monthly 40h quota reached" : "80% of monthly quota used";
  return (
    <li className={`card p-4 border ${box} flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${iconWrap} grid place-items-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className={`font-medium text-sm ${titleClr}`}>{title}</div>
          <div className="text-[11px] text-slate-500 font-mono">{formatTs(row.occurred_at)}</div>
        </div>
        <div className="text-sm text-slate-200/90 mt-1">{row.summary}</div>
        <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
          {agentName && <span>Agent: <span className="text-slate-300">{agentName}</span></span>}
          {clientCompany && <span>Client: <span className="text-slate-300">{clientCompany}</span></span>}
          {agentId && (
            <Link href={`/admin/agents/${agentId}/notifications`} className="text-cyan-300 hover:text-cyan-200">
              Open agent notifications →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}
