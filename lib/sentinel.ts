// Builds the Sentinel admin bundle in the exact shape the UI expects.
// Reads admin-created clients from sentinel_client (and, best-effort, your
// Better Auth `organization` rows) when DATABASE_URL is set; otherwise
// returns demo data so the dashboard always renders.

const STATUS_LABEL: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  blocked: "Blocked",
  churned: "Churned",
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
      { ts: "08:12:50", action: "plan_upgrade", client: "Winrich Hotel", detail: "Moved to Scale plan" },
      { ts: "07:50:11", action: "payment_received", client: "Tree House Chalets", detail: "$1,990 received" },
      { ts: "06:30:00", action: "signup", client: "Aether Labs", detail: "Started 14-day trial" },
    ],
    PAYMENTS: [
      { id: "P-2041", client: "Tree House Chalets", date: "2026-05-01", amount: 1990, plan: "Growth", method: "—", status: "Paid" },
      { id: "P-2042", client: "Winrich Hotel", date: "2026-05-01", amount: 1480, plan: "Scale", method: "—", status: "Paid" },
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
    CLIENT_INVOICES: [{ id: "INV-2041", date: "2026-05-01", amount: 1990, status: "Paid" }],
    announcements: [],
  };
}

const PLAN_FEE_CENTS: Record<string, number> = { Starter: 97600, Growth: 199000, Scale: 148000, Trial: 0 };

export async function getSentinelBundle() {
  if (!process.env.DATABASE_URL) return sentinelDemo();
  try {
    const { neon } = await import("@neondatabase/serverless");
    const { ensureSeed } = await import("./adminDb");
    const sql = neon(process.env.DATABASE_URL);
    await ensureSeed(sql as any);

    const cents = (n: number) => Math.round(Number(n) || 0) / 100;

    // Admin-created clients (these have logins and appear in the Clients tab).
    const clientRows: any[] = await sql`
      SELECT id, company, email, status, plan, mrr_cents, contact, created_at
      FROM sentinel_client ORDER BY created_at DESC`;

    // Best-effort: also surface existing Better Auth organizations (read-only).
    let orgRows: any[] = [];
    let members: Record<string, number> = {};
    try {
      orgRows = await sql`SELECT id, name, slug, "createdAt" AS created_at FROM organization ORDER BY "createdAt" DESC NULLS LAST`;
      const memberRows: any[] = await sql`SELECT "organizationId" AS oid, COUNT(*)::int AS c FROM member GROUP BY "organizationId"`;
      for (const r of memberRows) members[r.oid] = Number(r.c);
    } catch {
      orgRows = [];
    }

    const fromClients = clientRows.map((c) => ({
      id: String(c.id).slice(0, 10).toUpperCase(),
      workspaceId: c.id,
      company: c.company,
      contact: c.contact ?? "—",
      email: c.email,
      country: "—",
      plan: c.plan ?? "Custom",
      status: STATUS_LABEL[c.status] ?? "Active",
      mrr: cents(c.mrr_cents),
      totalPaid: cents(c.mrr_cents),
      agents: 0,
      joined: c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "—",
      lastActive: c.created_at ? relative(new Date(c.created_at)) : "—",
      phone: "—",
      timezone: "UTC",
    }));

    const clientEmails = new Set(clientRows.map((c) => String(c.email).toLowerCase()));
    const fromOrgs = orgRows
      .filter((o) => !clientEmails.has(`${o.slug}`.toLowerCase()))
      .map((o) => ({
        id: String(o.id).slice(0, 10).toUpperCase(),
        workspaceId: o.id,
        company: o.name,
        contact: "—",
        email: o.slug ?? "—",
        country: "—",
        plan: "Growth",
        status: "Active",
        mrr: cents(PLAN_FEE_CENTS.Growth),
        totalPaid: 0,
        agents: members[o.id] ?? 0,
        joined: o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : "—",
        lastActive: o.created_at ? relative(new Date(o.created_at)) : "—",
        phone: "—",
        timezone: "UTC",
      }));

    const CLIENTS = [...fromClients, ...fromOrgs];
    if (CLIENTS.length === 0) return sentinelDemo();

    const auditRows: any[] = await sql`SELECT admin_name, action, type, target, summary, occurred_at FROM sentinel_audit ORDER BY occurred_at DESC LIMIT 20`;

    const totalMrr = CLIENTS.reduce((s, c) => s + (c.status !== "Churned" ? c.mrr : 0), 0);
    const m = months12();
    const REVENUE_TREND = m.map((month, idx) => {
      const factor = Math.min(1, Math.max(0, (idx - 3) / 8));
      return { month, mrr: Math.round(totalMrr * factor), collected: Math.round(totalMrr * factor * 0.92) };
    });

    const countBy = (s: string) => CLIENTS.filter((c) => c.status === s).length;
    const CLIENT_BREAKDOWN = [
      { name: "Active", count: countBy("Active"), color: "#10b981" },
      { name: "Trial", count: countBy("Trial"), color: "#f59e0b" },
      { name: "Overdue", count: 0, color: "#f43f5e" },
      { name: "Blocked", count: countBy("Blocked"), color: "#6b7280" },
      { name: "Churned", count: countBy("Churned"), color: "#4b5563" },
    ];

    const ACTIVITY_FEED = auditRows.slice(0, 12).map((a) => ({
      ts: a.occurred_at ? new Date(a.occurred_at).toISOString().slice(11, 19) : "—",
      action: activityKey(a.action),
      client: a.target ?? "—",
      detail: a.summary,
    }));

    const AUDIT_LOG = auditRows.map((a) => ({
      ts: a.occurred_at ? new Date(a.occurred_at).toISOString().slice(0, 19).replace("T", " ") : "—",
      admin: a.admin_name,
      action: a.action,
      type: a.type,
      target: a.target ?? "—",
      ip: "—",
      details: a.summary,
    }));

    const byPlan: Record<string, number> = {};
    for (const c of CLIENTS) byPlan[c.plan] = (byPlan[c.plan] ?? 0) + (c.status !== "Churned" ? c.mrr : 0);
    const REVENUE_BY_PLAN = Object.entries(byPlan).map(([plan, revenue]) => ({ plan, revenue }));

    const demo = sentinelDemo();
    return {
      ...demo,
      CLIENTS,
      REVENUE_TREND,
      CLIENT_BREAKDOWN,
      ACTIVITY_FEED: ACTIVITY_FEED.length ? ACTIVITY_FEED : demo.ACTIVITY_FEED,
      AUDIT_LOG: AUDIT_LOG.length ? AUDIT_LOG : demo.AUDIT_LOG,
      PAYMENTS: [],
      REVENUE_BY_PLAN: REVENUE_BY_PLAN.length ? REVENUE_BY_PLAN : demo.REVENUE_BY_PLAN,
      OVERDUE: [],
      TICKETS: [],
      INCIDENTS: [],
    };
  } catch {
    return sentinelDemo();
  }
}
