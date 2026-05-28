import Link from "next/link";
import { Users } from "lucide-react";
import { getSalespeopleSummary, getSalespersonReport, money } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const statusPill: Record<string, string> = {
  live: "pill-emerald",
  paused: "pill-amber",
  draft: "pill-slate",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { sp?: string };
}) {
  const people = await getSalespeopleSummary();
  const selectedId = searchParams.sp || people[0]?.id;
  const report = selectedId ? await getSalespersonReport(selectedId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salesperson reports</h1>
        <p className="text-sm text-slate-400 mt-1">Sales attributed to each salesperson and the commission they earned.</p>
      </div>

      {people.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          No salespeople yet. Add some on the{" "}
          <Link href="/salespeople" className="text-cyan hover:underline">Salespeople</Link> tab.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <Link
                key={p.id}
                href={`/reports?sp=${p.id}`}
                className={
                  p.id === selectedId
                    ? "pill-cyan"
                    : "pill-slate hover:ring-white/20"
                }
              >
                <Users className="w-3 h-3" /> {p.name}
              </Link>
            ))}
          </div>

          {report && report.salesperson && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Total sales" value={money(report.totals.salesTotal)} />
                <Stat label="Commission earned" value={money(report.totals.commission)} accent />
                <Stat label="Agents" value={String(report.totals.agents)} />
                <Stat label="Clients" value={String(report.totals.clients)} />
              </div>

              <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-5 pb-3">
                  <div>
                    <div className="font-semibold">{report.salesperson.name}</div>
                    <div className="text-xs text-slate-500">{report.salesperson.email}</div>
                  </div>
                  <span className="text-xs text-slate-500">{report.rows.length} assignments</span>
                </div>
                {report.rows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Not assigned to any agents yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left stat-label border-b border-white/[0.08] bg-white/[0.02]">
                          <th className="py-3 px-4 font-medium">Agent</th>
                          <th className="py-3 px-4 font-medium">Client</th>
                          <th className="py-3 px-4 font-medium">Status</th>
                          <th className="py-3 px-4 font-medium text-right">Sales</th>
                          <th className="py-3 px-4 font-medium text-right">Rate</th>
                          <th className="py-3 px-4 font-medium text-right">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((r) => (
                          <tr key={r.agent.id} className="border-b border-white/[0.06] last:border-0">
                            <td className="py-3 px-4 font-medium text-slate-100">{r.agent.name}</td>
                            <td className="py-3 px-4 text-slate-300">
                              {r.client ? (
                                <Link href={`/clients/${r.client.id}`} className="hover:text-cyan">{r.client.name}</Link>
                              ) : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className={statusPill[r.agent.status] ?? "pill-slate"}>{r.agent.status}</span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-200">{money(r.salesTotal)}</td>
                            <td className="py-3 px-4 text-right text-slate-400">{r.commissionPercent}%</td>
                            <td className="py-3 px-4 text-right font-medium text-emerald">{money(r.commission)}</td>
                          </tr>
                        ))}
                        <tr className="bg-white/[0.02] font-semibold">
                          <td className="py-3 px-4" colSpan={3}>Total</td>
                          <td className="py-3 px-4 text-right">{money(report.totals.salesTotal)}</td>
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4 text-right text-emerald">{money(report.totals.commission)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="stat-label">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight mt-2 ${accent ? "text-emerald" : ""}`}>{value}</div>
    </div>
  );
}
