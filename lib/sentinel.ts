// Builds the Sentinel admin bundle in the exact shape the UI expects.
// CLIENTS come exclusively from the database (admin-created sentinel_client
// rows plus, best-effort, your Better Auth `organization` rows). There is no
// demo/sample client data: when the DB is unreachable or empty the bundle
// returns an empty-but-valid shape so the console renders without inventing
// fake clients.

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

// Platform-level scaffolding that is NOT client data (service health,
// agent templates) plus empty, correctly-shaped arrays for everything the
// console derives from clients. Used as the base for both the live bundle
// and the empty/error fallback — so no sample clients are ever served.
export function emptyBundle() {
  const m = months12();
  return {
    PLATFORM_NAME: "Sentinel",
    CLIENTS: [] as any[],
    REVENUE_TREND: m.map((month) => ({ month, mrr: 0, collected: 0 })),
    CLIENT_BREAKDOWN: [
      { name: "Active", count: 0, color: "#10b981" },
      { name: "Trial", count: 0, color: "#f59e0b" },
      { name: "Overdue", count: 0, color: "#f43f5e" },
      { name: "Blocked", count: 0, color: "#6b7280" },
      { name: "Churned", count: 0, color: "#4b5563" },
    ],
    ACTIVITY_FEED: [] as any[],
    PAYMENTS: [] as any[],
    OVERDUE: [] as any[],
    TICKETS: [] as any[],
    AUDIT_LOG: [] as any[],
    ADMIN_USERS: [] as any[],
    SERVICES: [
      { name: "API", status: "Operational", uptime: 99.98, latency: 142, lastIncident: "—" },
      { name: "Voice gateway", status: "Operational", uptime: 99.95, latency: 88, lastIncident: "—" },
      { name: "Dashboard", status: "Operational", uptime: 100, latency: 60, lastIncident: "—" },
      { name: "Webhooks", status: "Operational", uptime: 99.92, latency: 210, lastIncident: "—" },
    ],
    INCIDENTS: [] as any[],
    AGENT_TEMPLATES: [
      { id: "growth", name: "Booking Agent", description: "Calendar reservations & confirmations", model: "balanced", voice: "Nova", channel: "voice", voiceCost: 0.1, aiCost: 0.002, callCost: 0.12, active: true },
      { id: "scale", name: "Support Agent", description: "Inbound resolution & customer care", model: "quality", voice: "Aria", channel: "voice", voiceCost: 0.12, aiCost: 0.003, callCost: 0.14, active: true },
      { id: "starter", name: "Sales Agent", description: "Outbound conversion & pipeline", model: "fast", voice: "Rex", channel: "voice", voiceCost: 0.09, aiCost: 0.002, callCost: 0.1, active: true },
    ],
    EARNINGS_MONTHLY: m.map((month) => ({ month, clients: 0, newClients: 0, churned: 0, invoiced: 0, collected: 0, outstanding: 0, netMrr: 0 })),
    REVENUE_BY_PLAN: [] as any[],
    MRR_MOVEMENT: [
      { kind: "New", value: 0, color: "#10b981" },
      { kind: "Expansion", value: 0, color: "#34d399" },
      { kind: "Contraction", value: 0, color: "#f59e0b" },
      { kind: "Churned", value: 0, color: "#f43f5e" },
    ],
    CLIENT_INVOICES: [] as any[],
    announcements: [] as any[],
  };
}

const PLAN_FEE_CENTS: Record<string, number> = { Starter: 97600, Growth: 199000, Scale: 148000, Trial: 0 };

export async function getSentinelBundle() {
  if (!process.env.DATABASE_URL) return emptyBundle();
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

    // Real agent counts per client.
    const agentCounts: Record<string, number> = {};
    try {
      const ac: any[] = await sql`SELECT client_id, COUNT(*)::int AS n FROM sentinel_agent GROUP BY client_id`;
      for (const r of ac) agentCounts[r.client_id] = Number(r.n);
    } catch {}

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
      agents: agentCounts[c.id] ?? 0,
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

    const auditRows: any[] = await sql`SELECT admin_name, action, type, target, summary, occurred_at FROM sentinel_audit ORDER BY occurred_at DESC LIMIT 20`;
    const adminRows: any[] = await sql`SELECT name, email, created_at FROM sentinel_admin ORDER BY created_at ASC`;

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

    const ADMIN_USERS = adminRows.map((a) => ({
      name: a.name,
      email: a.email,
      role: "Super Admin",
      lastLogin: "—",
      status: "Active",
    }));

    return {
      ...emptyBundle(),
      CLIENTS,
      REVENUE_TREND,
      CLIENT_BREAKDOWN,
      ACTIVITY_FEED,
      AUDIT_LOG,
      REVENUE_BY_PLAN,
      ADMIN_USERS,
    };
  } catch (e) {
    console.error("getSentinelBundle failed:", e);
    return emptyBundle();
  }
}
