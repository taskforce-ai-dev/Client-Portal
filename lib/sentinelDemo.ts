// Demo data for the Sentinel admin console (/api/admin/sentinel-bundle).
// Shapes match what the bundle reads: CLIENTS[{name,email,plan,status,mrr}],
// CLIENT_BREAKDOWN[{label,count,color}], REVENUE_TREND[{month,mrr,collected}],
// ACTIVITY_FEED[{action,detail,ts,color}], etc. Header metrics (MRR/ARR/ARPC)
// are computed by the UI from CLIENTS.

const GREEN = "#34d399";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SLATE = "#94a3b8";
const CYAN = "#00d4ff";
const VIOLET = "#7b61ff";

export function sentinelBundle() {
  const CLIENTS = [
    { name: "Tree House Chalets", email: "hello@treehousechalets.com", plan: "Growth", status: "active", mrr: 1990 },
    { name: "Winrich Hotel", email: "ops@winrich.com", plan: "Scale", status: "active", mrr: 1480 },
    { name: "Flico", email: "team@flico.io", plan: "Starter", status: "active", mrr: 976 },
    { name: "Aether Labs", email: "founder@aether.ai", plan: "Trial", status: "trial", mrr: 0 },
    { name: "Northwind Co", email: "admin@northwind.co", plan: "Growth", status: "blocked", mrr: 0 },
  ];

  const CLIENT_BREAKDOWN = [
    { label: "Active", count: 3, color: GREEN },
    { label: "Trial", count: 1, color: AMBER },
    { label: "Overdue", count: 0, color: RED },
    { label: "Blocked", count: 1, color: SLATE },
  ];

  const months = ["Jun '25","Jul '25","Aug '25","Sep '25","Oct '25","Nov '25","Dec '25","Jan '26","Feb '26","Mar '26","Apr '26","May '26"];
  const mrrCurve = [0, 0, 0, 0, 120, 360, 720, 1200, 1850, 2600, 3500, 4446];
  const REVENUE_TREND = months.map((month, i) => ({
    month,
    mrr: mrrCurve[i],
    collected: Math.round(mrrCurve[i] * 0.92),
    value: mrrCurve[i],
  }));

  const MRR_MOVEMENT = months.slice(-6).map((month, i) => ({
    month,
    value: [620, 750, 700, 900, 910, 946][i],
  }));

  const EARNINGS_MONTHLY = months.slice(-6).map((month, i) => ({
    month,
    value: [1800, 2100, 2400, 3000, 3600, 4096][i],
    amount: [1800, 2100, 2400, 3000, 3600, 4096][i],
  }));

  const REVENUE_BY_PLAN = [
    { label: "Growth", plan: "Growth", value: 3980, color: CYAN },
    { label: "Scale", plan: "Scale", value: 1480, color: VIOLET },
    { label: "Starter", plan: "Starter", value: 976, color: GREEN },
  ];

  const ACTIVITY_FEED = [
    { action: "Agent created", detail: "Reset password · chanya@treehousechalets (Tree House Chalets)", ts: "09:39:06", color: GREEN },
    { action: "Agent created", detail: "Added Chanya (chanya@…) to Tree House Chalets", ts: "09:38:33", color: CYAN },
    { action: "Client activated", detail: "Winrich Hotel moved to Scale plan", ts: "08:12:50", color: GREEN },
    { action: "Payment received", detail: "$1,990 · Tree House Chalets", ts: "Yesterday", color: VIOLET },
    { action: "Trial started", detail: "Aether Labs began a 14-day trial", ts: "2d ago", color: AMBER },
  ];

  const ADMIN_USERS = [
    { name: "Maya Reyes", email: "maya@taskforceai.tech", role: "super_admin", status: "active" },
    { name: "Chrys Fernando", email: "chrys@taskforceai.tech", role: "super_admin", status: "active" },
  ];

  const SERVICES = [
    { name: "API", status: "operational", value: 99.98 },
    { name: "Voice gateway", status: "operational", value: 99.95 },
    { name: "Dashboard", status: "operational", value: 100 },
    { name: "Webhooks", status: "operational", value: 99.92 },
  ];

  const AGENT_TEMPLATES = [
    { name: "Booking Agent", label: "Booking", count: 4, value: 4 },
    { name: "Support Agent", label: "Support", count: 2, value: 2 },
    { name: "Sales Agent", label: "Sales", count: 1, value: 1 },
  ];

  return {
    PLATFORM_NAME: "Sentinel",
    CLIENTS,
    CLIENT_BREAKDOWN,
    REVENUE_TREND,
    MRR_MOVEMENT,
    EARNINGS_MONTHLY,
    REVENUE_BY_PLAN,
    ACTIVITY_FEED,
    ADMIN_USERS,
    SERVICES,
    AGENT_TEMPLATES,
    PAYMENTS: [],
    OVERDUE: [],
    TICKETS: [],
    AUDIT_LOG: ACTIVITY_FEED.map((a) => ({ action: a.action, summary: a.detail, occurredLabel: a.ts })),
    INCIDENTS: [],
    CLIENT_INVOICES: [],
  };
}
