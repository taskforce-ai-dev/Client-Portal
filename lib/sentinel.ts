// Builds the Sentinel admin bundle in the exact shape the UI expects.
// Reads from Postgres (Prisma) when DATABASE_URL is set and seeded;
// otherwise returns demo data so the dashboard still renders.

const STATUS_LABEL: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  blocked: "Blocked",
  churned: "Churned",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  support: "Support",
  billing: "Finance",
  operations: "Operations",
};

function months12(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '"));
  }
  return out;
}

function activityKey(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("created") || a.includes("signup")) return "signup";
  if (a.includes("suspend") || a.includes("block") || a.includes("delete")) return "account_blocked";
  if (a.includes("fail")) return "payment_failed";
  if (a.includes("payment") || a.includes("invoice")) return "payment_received";
  if (a.includes("agent")) return "agent_created";
  if (a.includes("ticket")) return "ticket_opened";
  if (a.includes("plan")) return "plan_upgrade";
  return "agent_created";
}

function relative(d: Date): string {
  const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function sentinelDemo() {
  const m = months12();
  const curve = [0, 0, 0, 0, 120, 360, 720, 1200, 1850, 2600, 3500, 4446];
  const REVENUE_TREND = m.map((month, i) => ({ month, mrr: curve[i], collected: Math.round(curve[i] * 0.92) }));
  const EARNINGS_MONTHLY = m.map((month, i) => {
    const invoiced = curve[i];
    const collected = Math.round(curve[i] * 0.92);
    return { month, clients: Math.min(5, Math.max(0, Math.round((i - 3) * 0.8))), newClients: i >= 8 ? 1 : 0, churned: 0, invoiced, collected, outstanding: invoiced - collected, netMrr: curve[i] };
  });
  return {
    PLATFORM_NAME: "Sentinel",
    CLIENTS: [
      { id: "TH-1042", workspaceId: "ws_treehouse", company: "Tree House Chalets", contact: "Chrys Fernando", email: "hello@treehousechalets.com", country: "LK", plan: "Growth", status: "Active", mrr: 1990, totalPaid: 5970, agents: 1, joined: "2026-03-12", lastActive: "2h ago", phone: "+94 71 707 3529", timezone: "Asia/Colombo" },
      { id: "WR-1039", workspaceId: "ws_winrich", company: "Winrich Hotel", contact: "Ops Team", email: "ops@winrich.com", country: "LK", plan: "Scale", status: "Active", mrr: 1480, totalPaid: 4440, agents: 2, joined: "2026-02-02", lastActive: "5h ago", phone: "—", timezone: "Asia/Colombo" },
      { id: "FL-1051", workspaceId: "ws_flico", company: "Flico", contact: "Flico Team", email: "team@flico.io", country: "US", plan: "Starter", status: "Active", mrr: 976, totalPaid: 2928, agents: 1, joined: "2026-04-18", lastActive: "1d ago", phone: "—", timezone: "UTC" },
      { id: "AE-1063", workspaceId: "ws_aether", company: "Aether Labs", contact: "Founder", email: "founder@aether.ai", country: "US", plan: "Trial", status: "Trial", mrr: 0, totalPaid: 0, agents: 1, joined: "2026-05-20", lastActive: "3h ago", phone: "—", timezone: "UTC" },
      { id: "NW-1009", workspaceId: "ws_northwind", company: "Northwind Co", contact: "Admin", email: "admin@northwind.co", country: "GB", plan: "Growth", status: "Blocked", mrr: 0, totalPaid: 1990, agents: 0, joined: "2025-11-21", lastActive: "21d ago", phone: "—", timezone: "Europe/London" },
    ],
    REVENUE_TREND,
    CLIENT_BREAKDOWN: [
      { name: "Active", count: 3, color: "#10b981" },
      { name: "Trial", count: 1, color: "#f59e0b" },
      { name: "Overdue", count: 0, color: "#f43f5e" },
      { name: "Blocked", count: 1, color: "#6b7280" },
      { name: "Churned", count: 0, color: "#4b5563" },
    ],
    ACTIVITY_FEED: [
      { ts: "09:39:06", action: "agent_created", client: "Tree House Chalets", detail: "Reset password · chanya@treehousechalets" },
      { ts: "09:38:33", action: "agent_created", client: "Tree House Chalets", detail: "Added Chanya to Tree House Chalets" },
      { ts: "08:12:50", action: "plan_upgrade", client: "Winrich Hotel", detail: "Moved to Scale plan" },
      { ts: "07:50:11", action: "payment_received", client: "Tree House Chalets", detail: "$1,990 received" },
      { ts: "06:30:00", action: "signup", client: "Aether Labs", detail: "Started 14-day trial" },
    ],
    PAYMENTS: [
      { id: "P-2041", client: "Tree House Chalets", date: "2026-05-01", amount: 1990, plan: "Growth", method: "—", status: "Paid" },
      { id: "P-2042", client: "Winrich Hotel", date: "2026-05-01", amount: 1480, plan: "Scale", method: "—", status: "Paid" },
      { id: "P-2043", client: "Flico", date: "2026-05-12", amount: 976, plan: "Starter", method: "—", status: "Pending" },
    ],
    OVERDUE: [],
    TICKETS: [],
    AUDIT_LOG: [
      { ts: "2026-05-28 09:39:06", admin: "Maya Reyes", action: "Agent Create", type: "agent", target: "Tree House Chalets", ip: "—", details: "Reset password" },
    ],
    ADMIN_USERS: [
      { name: "Maya Reyes", email: "maya@taskforceai.tech", role: "Super Admin", lastLogin: "Today", status: "Active" },
      { name: "Chrys Fernando", email: "chrys@taskforceai.tech", role: "Super Admin", lastLogin: "Today", status: "Active" },
    ],
    SERVICES: [
      { name: "API", status: "Operational", uptime: 99.98, latency: 142, lastIncident: "—" },
      { name: "Voice gateway", status: "Operational", uptime: 99.95, latency: 88, lastIncident: "12d ago" },
      { name: "Dashboard", status: "Operational", uptime: 100, latency: 60, lastIncident: "—" },
    ],
    INCIDENTS: [],
    AGENT_TEMPLATES: [
      { id: "growth", name: "Booking Agent", description: "Calendar reservations & confirmations", model: "balanced", voice: "Nova", channel: "voice", voiceCost: 0.1, aiCost: 0.002, callCost: 0.12, active: true },
    ],
    EARNINGS_MONTHLY,
    REVENUE_BY_PLAN: [
      { plan: "Growth", revenue: 1990 },
      { plan: "Scale", revenue: 1480 },
      { plan: "Starter", revenue: 976 },
    ],
    MRR_MOVEMENT: [
      { kind: "New", value: 976, color: "#10b981" },
      { kind: "Expansion", value: 490, color: "#34d399" },
      { kind: "Contraction", value: 0, color: "#f59e0b" },
      { kind: "Churned", value: 0, color: "#f43f5e" },
    ],
    CLIENT_INVOICES: [
      { id: "INV-2041", date: "2026-05-01", amount: 1990, status: "Paid" },
    ],
    announcements: [],
  };
}

export async function getSentinelBundle() {
  if (!process.env.DATABASE_URL) return sentinelDemo();
  try {
    const { prisma } = await import("./prisma");
    const [clients, invoices, admins, audit, plans] = await Promise.all([
      prisma.client.findMany({ include: { plan: true, _count: { select: { agents: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.invoice.findMany({ include: { client: { include: { plan: true } } } }),
      prisma.adminUser.findMany(),
      prisma.auditLog.findMany({ orderBy: { occurredAt: "desc" }, take: 20 }),
      prisma.plan.findMany(),
    ]);

    if (clients.length === 0) return sentinelDemo();

    const cents = (n: number) => Math.round(n) / 100;
    const CLIENTS = clients.map((c) => {
      const paid = invoices.filter((i) => i.clientId === c.id && i.status === "paid").reduce((s, i) => s + i.amountCents, 0);
      return {
        id: c.id.slice(0, 8).toUpperCase(),
        workspaceId: c.id,
        company: c.company,
        contact: c.contact ?? "—",
        email: c.email,
        country: c.country ?? "—",
        plan: c.plan?.name ?? "Custom",
        status: STATUS_LABEL[c.status] ?? "Active",
        mrr: cents(c.plan?.monthlyFeeCents ?? 0),
        totalPaid: cents(paid),
        agents: c._count.agents,
        joined: c.createdAt.toISOString().slice(0, 10),
        lastActive: relative(c.updatedAt),
        phone: c.phone ?? "—",
        timezone: c.timezone,
      };
    });

    const m = months12();
    const REVENUE_TREND = m.map((month, idx) => {
      const monthDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (11 - idx), 1));
      const next = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));
      const inMonth = invoices.filter((i) => i.issuedAt >= monthDate && i.issuedAt < next);
      const collected = inMonth.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);
      const mrr = clients.reduce((s, c) => s + (c.createdAt <= next && c.status !== "churned" ? c.plan?.monthlyFeeCents ?? 0 : 0), 0);
      return { month, mrr: cents(mrr), collected: cents(collected) };
    });

    const countBy = (s: string) => CLIENTS.filter((c) => c.status === s).length;
    const CLIENT_BREAKDOWN = [
      { name: "Active", count: countBy("Active"), color: "#10b981" },
      { name: "Trial", count: countBy("Trial"), color: "#f59e0b" },
      { name: "Overdue", count: invoices.filter((i) => i.status === "overdue").length, color: "#f43f5e" },
      { name: "Blocked", count: countBy("Blocked"), color: "#6b7280" },
      { name: "Churned", count: countBy("Churned"), color: "#4b5563" },
    ];

    const ACTIVITY_FEED = audit.slice(0, 12).map((a) => ({
      ts: a.occurredAt.toISOString().slice(11, 19),
      action: activityKey(a.action),
      client: a.target ?? "—",
      detail: a.summary,
    }));

    const PAYMENTS = invoices.slice(0, 14).map((i) => ({
      id: `P-${i.id.slice(0, 6)}`,
      client: i.client.company,
      date: i.issuedAt.toISOString().slice(0, 10),
      amount: cents(i.amountCents),
      plan: i.client.plan?.name ?? "—",
      method: "—",
      status: i.status.charAt(0).toUpperCase() + i.status.slice(1),
    }));

    const ADMIN_USERS = admins.map((a) => ({
      name: a.name,
      email: a.email,
      role: ROLE_LABEL[a.role] ?? "Operations",
      lastLogin: a.lastLoginAt ? relative(a.lastLoginAt) : "Never",
      status: a.isActive ? "Active" : "Revoked",
    }));

    const AUDIT_LOG = audit.map((a) => ({
      ts: a.occurredAt.toISOString().slice(0, 19).replace("T", " "),
      admin: a.adminName,
      action: a.action,
      type: a.type,
      target: a.target ?? "—",
      ip: "—",
      details: a.summary,
    }));

    const REVENUE_BY_PLAN = plans.map((p) => ({
      plan: p.name,
      revenue: cents(p.monthlyFeeCents * clients.filter((c) => c.planId === p.id && c.status !== "churned").length),
    }));

    const demo = sentinelDemo();
    return {
      ...demo,
      CLIENTS,
      REVENUE_TREND,
      CLIENT_BREAKDOWN,
      ACTIVITY_FEED,
      PAYMENTS,
      ADMIN_USERS,
      AUDIT_LOG,
      REVENUE_BY_PLAN: REVENUE_BY_PLAN.length ? REVENUE_BY_PLAN : demo.REVENUE_BY_PLAN,
      OVERDUE: [],
      TICKETS: [],
      INCIDENTS: [],
    };
  } catch {
    return sentinelDemo();
  }
}
