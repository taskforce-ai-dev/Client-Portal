import { getDB } from "./store";
import type { Agent, Client, Sale, Salesperson } from "./types";

export function salesTotalFor(sales: Sale[], agentId: string): number {
  return sales.filter((s) => s.agentId === agentId).reduce((sum, s) => sum + s.amount, 0);
}

export type AgentWithSales = Agent & {
  salesTotal: number;
  commission: number;
  salesperson: Salesperson | null;
  client: Client | null;
};

export async function getOverview() {
  const db = await getDB();
  const totalSales = db.sales.reduce((s, x) => s + x.amount, 0);
  const totalCommission = db.agents.reduce((sum, a) => {
    const t = salesTotalFor(db.sales, a.id);
    return sum + (t * a.commissionPercent) / 100;
  }, 0);
  return {
    clients: db.clients.length,
    activeClients: db.clients.filter((c) => c.status === "active").length,
    agents: db.agents.length,
    liveAgents: db.agents.filter((a) => a.status === "live").length,
    salespeople: db.salespeople.length,
    totalSales,
    totalCommission,
    sales: db.sales.length,
  };
}

export async function getClientAgents(clientId: string): Promise<AgentWithSales[]> {
  const db = await getDB();
  return db.agents
    .filter((a) => a.clientId === clientId)
    .map((a) => {
      const salesTotal = salesTotalFor(db.sales, a.id);
      const salesperson = db.salespeople.find((s) => s.id === a.salespersonId) ?? null;
      return {
        ...a,
        salesTotal,
        commission: (salesTotal * a.commissionPercent) / 100,
        salesperson,
        client: db.clients.find((c) => c.id === clientId) ?? null,
      };
    });
}

export type SalespersonReportRow = {
  agent: Agent;
  client: Client | null;
  salesTotal: number;
  commissionPercent: number;
  commission: number;
};

export async function getSalespersonReport(spId: string): Promise<{
  salesperson: Salesperson | null;
  rows: SalespersonReportRow[];
  totals: { salesTotal: number; commission: number; clients: number; agents: number };
} | null> {
  const db = await getDB();
  const salesperson = db.salespeople.find((s) => s.id === spId) ?? null;
  if (!salesperson) return null;

  const agents = db.agents.filter((a) => a.salespersonId === spId);
  const rows: SalespersonReportRow[] = agents.map((agent) => {
    const salesTotal = salesTotalFor(db.sales, agent.id);
    return {
      agent,
      client: db.clients.find((c) => c.id === agent.clientId) ?? null,
      salesTotal,
      commissionPercent: agent.commissionPercent,
      commission: (salesTotal * agent.commissionPercent) / 100,
    };
  });

  const totals = {
    salesTotal: rows.reduce((s, r) => s + r.salesTotal, 0),
    commission: rows.reduce((s, r) => s + r.commission, 0),
    clients: new Set(agents.map((a) => a.clientId)).size,
    agents: agents.length,
  };

  return { salesperson, rows, totals };
}

export async function getSalespeopleSummary() {
  const db = await getDB();
  return db.salespeople
    .map((sp) => {
      const agents = db.agents.filter((a) => a.salespersonId === sp.id);
      const salesTotal = agents.reduce((s, a) => s + salesTotalFor(db.sales, a.id), 0);
      const commission = agents.reduce(
        (s, a) => s + (salesTotalFor(db.sales, a.id) * a.commissionPercent) / 100,
        0
      );
      return {
        ...sp,
        agents: agents.length,
        clients: new Set(agents.map((a) => a.clientId)).size,
        salesTotal,
        commission,
      };
    })
    .sort((a, b) => b.salesTotal - a.salesTotal);
}

export function money(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
