import Link from "next/link";
import { ArrowRight, Building2, Users } from "lucide-react";
import Kpi from "@/components/Kpi";
import StatusPill from "@/components/StatusPill";
import { getOverview, getSalespeopleSummary, money } from "@/lib/metrics";
import { listClients } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [stats, clients, salespeople] = await Promise.all([
    getOverview(),
    listClients(),
    getSalespeopleSummary(),
  ]);
  const recentClients = clients.slice(0, 5);
  const topSales = salespeople.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-slate-400 mt-1">Everything across your TaskforceAI accounts.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Clients" value={String(stats.clients)} hint={`${stats.activeClients} active`} />
        <Kpi label="Agents" value={String(stats.agents)} hint={`${stats.liveAgents} live`} />
        <Kpi label="Total sales" value={money(stats.totalSales)} hint={`${stats.sales} sales logged`} />
        <Kpi label="Commission owed" value={money(stats.totalCommission)} hint={`${stats.salespeople} salespeople`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan" /> Recent clients
            </div>
            <Link href="/clients" className="text-xs text-cyan hover:underline">View all</Link>
          </div>
          {recentClients.length === 0 ? (
            <EmptyRow label="No clients yet." cta={{ href: "/clients", label: "Create your first client" }} />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentClients.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center justify-between py-3 group">
                    <div>
                      <div className="text-sm font-medium group-hover:text-white">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.company}</div>
                    </div>
                    <StatusPill status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-violet" /> Top salespeople
            </div>
            <Link href="/salespeople" className="text-xs text-cyan hover:underline">View all</Link>
          </div>
          {topSales.length === 0 ? (
            <EmptyRow label="No salespeople yet." cta={{ href: "/salespeople", label: "Add a salesperson" }} />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {topSales.map((sp) => (
                <li key={sp.id}>
                  <Link href={`/reports?sp=${sp.id}`} className="flex items-center justify-between py-3 group">
                    <div>
                      <div className="text-sm font-medium group-hover:text-white">{sp.name}</div>
                      <div className="text-xs text-slate-500">{sp.agents} agents · {sp.clients} clients</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{money(sp.salesTotal)}</div>
                      <div className="text-[11px] text-emerald">{money(sp.commission)} comm.</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ label, cta }: { label: string; cta: { href: string; label: string } }) {
  return (
    <div className="py-8 text-center">
      <div className="text-sm text-slate-500">{label}</div>
      <Link href={cta.href} className="inline-flex items-center gap-1.5 text-xs text-cyan hover:underline mt-2">
        {cta.label} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
