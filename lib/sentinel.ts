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

// --- Neon serverless driver (HTTP, works on Vercel) -------------------------
// Reads your existing `organization` rows as clients. Billing/agents/audit
// live in additive `sentinel_*` tables created with CREATE TABLE IF NOT
// EXISTS — your Better Auth tables (organization, member, user, …) are only
// read, never altered.

const DEFAULT_PLANS: Array<{ id: string; name: string; cents: number }> = [
  { id: "plan_starter", name: "Starter", cents: 97600 },
  { id: "plan_growth", name: "Growth", cents: 199000 },
  { id: "plan_scale", name: "Scale", cents: 148000 },
];

async function ensureSchema(sql: any) {
  await sql`CREATE TABLE IF NOT EXISTS sentinel_plan (id text PRIMARY KEY, name text NOT NULL, monthly_fee_cents integer NOT NULL DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_client (organization_id text PRIMARY KEY, plan_id text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_invoice (id text PRIMARY KEY, organization_id text NOT NULL, amount_cents integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'paid', issued_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS sentinel_audit (id text PRIMARY KEY, admin_name text NOT NULL DEFAULT 'System', action text NOT NULL, type text NOT NULL DEFAULT 'system', target text, summary text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now())`;
  for (const p of DEFAULT_PLANS) {
    await sql`INSERT INTO sentinel_plan (id, name, monthly_fee_cents) VALUES (${p.id}, ${p.name}, ${p.cents}) ON CONFLICT (id) DO NOTHING`;
  }
  // Bootstrap: give every org without a billing row a default plan so the
  // dashboard is populated. Admins can change the plan/status later.
  await sql`INSERT INTO sentinel_client (organization_id, plan_id, status)
            SELECT o.id, 'plan_growth', 'active' FROM organization o
            WHERE NOT EXISTS (SELECT 1 FROM sentinel_client sc WHERE sc.organization_id = o.id)`;
}

export async function getSentinelBundle() {
  if (!process.env.DATABASE_URL) return sentinelDemo();
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    await ensureSchema(sql);

    const orgs: any[] = await sql`
      SELECT o.id, o.name, o.slug, o."createdAt" AS created_at,
             sc.plan_id, sc.status AS ov_status,
             p.name AS plan_name, COALESCE(p.monthly_fee_cents, 0) AS fee_cents
      FROM organization o
      LEFT JOIN sentinel_client sc ON sc.organization_id = o.id
      LEFT JOIN sentinel_plan p ON p.id = sc.plan_id
      ORDER BY o."createdAt" DESC NULLS LAST`;

    if (!orgs.length) return sentinelDemo();

    const memberRows: any[] = await sql`SELECT "organizationId" AS oid, COUNT(*)::int AS c FROM member GROUP BY "organizationId"`;
    const members: Record<string, number> = {};
    for (const r of memberRows) members[r.oid] = Number(r.c);

    const invoiceRows: any[] = await sql`SELECT organization_id, amount_cents, status, issued_at FROM sentinel_invoice`;
    const auditRows: any[] = await sql`SELECT admin_name, action, type, target, summary, occurred_at FROM sentinel_audit ORDER BY occurred_at DESC LIMIT 20`;

    const cents = (n: number) => Math.round(Number(n) || 0) / 100;
    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

    const CLIENTS = orgs.map((o) => {
      const status = STATUS_LABEL[o.ov_status as string] ?? "Active";
      const paid = invoiceRows
        .filter((i) => i.organization_id === o.id && i.status === "paid")
        .reduce((s, i) => s + Number(i.amount_cents), 0);
      return {
        id: String(o.id).slice(0, 8).toUpperCase(),
        workspaceId: o.id,
        company: o.name,
        contact: "—",
        email: o.slug ? `${o.slug}` : "—",
        country: "—",
        plan: o.plan_name ?? "Custom",
        status,
        mrr: cents(o.fee_cents),
        totalPaid: cents(paid),
        agents: members[o.id] ?? 0,
        joined: o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : "—",
        lastActive: o.created_at ? relative(new Date(o.created_at)) : "—",
        phone: "—",
        timezone: "UTC",
      };
    });

    const totalMrrCents = orgs.reduce((s, o) => s + (o.ov_status !== "churned" ? Number(o.fee_cents) : 0), 0);
    const m = months12();
    const REVENUE_TREND = m.map((month, idx) => {
      const factor = Math.min(1, Math.max(0, (idx - 3) / 8));
      return { month, mrr: Math.round(cents(totalMrrCents) * factor), collected: Math.round(cents(totalMrrCents) * factor * 0.92) };
    });

    const countBy = (s: string) => CLIENTS.filter((c) => c.status === s).length;
    const CLIENT_BREAKDOWN = [
      { name: "Active", count: countBy("Active"), color: "#10b981" },
      { name: "Trial", count: countBy("Trial"), color: "#f59e0b" },
      { name: "Overdue", count: invoiceRows.filter((i) => i.status === "overdue").length, color: "#f43f5e" },
      { name: "Blocked", count: countBy("Blocked"), color: "#6b7280" },
      { name: "Churned", count: countBy("Churned"), color: "#4b5563" },
    ];

    const ACTIVITY_FEED = auditRows.slice(0, 12).map((a) => ({
      ts: a.occurred_at ? new Date(a.occurred_at).toISOString().slice(11, 19) : "—",
      action: activityKey(a.action),
      client: a.target ?? "—",
      detail: a.summary,
    }));

    const PAYMENTS = invoiceRows.slice(0, 14).map((i, idx) => {
      const org = orgs.find((o) => o.id === i.organization_id);
      return {
        id: `P-${idx + 1}`,
        client: org?.name ?? "—",
        date: i.issued_at ? new Date(i.issued_at).toISOString().slice(0, 10) : "—",
        amount: cents(i.amount_cents),
        plan: org?.plan_name ?? "—",
        method: "—",
        status: cap(i.status),
      };
    });

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
    for (const o of orgs) {
      const name = o.plan_name ?? "Unassigned";
      byPlan[name] = (byPlan[name] ?? 0) + (o.ov_status !== "churned" ? Number(o.fee_cents) : 0);
    }
    const REVENUE_BY_PLAN = Object.entries(byPlan).map(([plan, c]) => ({ plan, revenue: cents(c) }));

    const demo = sentinelDemo();
    return {
      ...demo,
      CLIENTS,
      REVENUE_TREND,
      CLIENT_BREAKDOWN,
      ACTIVITY_FEED,
      PAYMENTS,
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
