/* ============================================================
   Sentinel Super Admin Console — data wiring
   Data is baked in here so the console renders reliably without
   depending on a runtime API call. Replace window.__LIVE_ADMIN with a
   fetch to your backend when you wire one up.
   ============================================================ */
window.__LIVE_ADMIN = {
  CLIENTS: [
    { id: "cli_treehouse", name: "Tree House Chalets", slug: "tree-house-chalets", contactName: "Chrys Fernando", contactEmail: "hello@treehousechalets.com", contactPhone: "+94 71 707 3529", plan: { name: "Growth" }, status: "active", mrr: 1990, monthlyBudget: 3000, timezone: "Asia/Colombo", defaultLanguage: "en", usage: { totalSpend: 1180, percentUsed: 39 }, counts: { agents: 1, openSupportTickets: 0 } },
    { id: "cli_winrich", name: "Winrich Hotel", slug: "winrich-hotel", contactName: "Ops Team", contactEmail: "ops@winrich.com", contactPhone: "", plan: { name: "Scale" }, status: "active", mrr: 1480, monthlyBudget: 2500, timezone: "Asia/Colombo", defaultLanguage: "en", usage: { totalSpend: 980, percentUsed: 39 }, counts: { agents: 2, openSupportTickets: 1 } },
    { id: "cli_flico", name: "Flico", slug: "flico", contactName: "Flico Team", contactEmail: "team@flico.io", contactPhone: "", plan: { name: "Starter" }, status: "active", mrr: 976, monthlyBudget: 1500, timezone: "UTC", defaultLanguage: "en", usage: { totalSpend: 410, percentUsed: 27 }, counts: { agents: 1, openSupportTickets: 0 } },
    { id: "cli_aether", name: "Aether Labs", slug: "aether-labs", contactName: "Founder", contactEmail: "founder@aether.ai", contactPhone: "", plan: { name: "Trial" }, status: "trial", mrr: 0, monthlyBudget: 0, timezone: "UTC", defaultLanguage: "en", usage: { totalSpend: 0, percentUsed: 0 }, counts: { agents: 1, openSupportTickets: 0 } },
    { id: "cli_northwind", name: "Northwind Co", slug: "northwind-co", contactName: "Admin", contactEmail: "admin@northwind.co", contactPhone: "", plan: { name: "Growth" }, status: "blocked", mrr: 0, monthlyBudget: 2000, timezone: "UTC", defaultLanguage: "en", usage: { totalSpend: 0, percentUsed: 0 }, counts: { agents: 0, openSupportTickets: 0 } }
  ],
  CLIENT_BREAKDOWN: [
    { label: "Active", count: 3, color: "#34d399" },
    { label: "Trial", count: 1, color: "#f59e0b" },
    { label: "Overdue", count: 0, color: "#ef4444" },
    { label: "Blocked", count: 1, color: "#94a3b8" }
  ],
  REVENUE_TREND: [
    { month: "Jun '25", mrr: 0, collected: 0, value: 0 },
    { month: "Jul '25", mrr: 0, collected: 0, value: 0 },
    { month: "Aug '25", mrr: 0, collected: 0, value: 0 },
    { month: "Sep '25", mrr: 0, collected: 0, value: 0 },
    { month: "Oct '25", mrr: 120, collected: 110, value: 120 },
    { month: "Nov '25", mrr: 360, collected: 330, value: 360 },
    { month: "Dec '25", mrr: 720, collected: 660, value: 720 },
    { month: "Jan '26", mrr: 1200, collected: 1100, value: 1200 },
    { month: "Feb '26", mrr: 1850, collected: 1700, value: 1850 },
    { month: "Mar '26", mrr: 2600, collected: 2400, value: 2600 },
    { month: "Apr '26", mrr: 3500, collected: 3220, value: 3500 },
    { month: "May '26", mrr: 4446, collected: 4090, value: 4446 }
  ],
  MRR_MOVEMENT: [
    { month: "Dec '25", value: 620 }, { month: "Jan '26", value: 750 }, { month: "Feb '26", value: 700 },
    { month: "Mar '26", value: 900 }, { month: "Apr '26", value: 910 }, { month: "May '26", value: 946 }
  ],
  EARNINGS_MONTHLY: [
    { month: "Dec '25", value: 1800, amount: 1800 }, { month: "Jan '26", value: 2100, amount: 2100 },
    { month: "Feb '26", value: 2400, amount: 2400 }, { month: "Mar '26", value: 3000, amount: 3000 },
    { month: "Apr '26", value: 3600, amount: 3600 }, { month: "May '26", value: 4096, amount: 4096 }
  ],
  REVENUE_BY_PLAN: [
    { label: "Growth", plan: "Growth", value: 3980, color: "#00d4ff" },
    { label: "Scale", plan: "Scale", value: 1480, color: "#7b61ff" },
    { label: "Starter", plan: "Starter", value: 976, color: "#34d399" }
  ],
  ACTIVITY_FEED: [
    { action: "Agent created", detail: "Reset password · chanya@treehousechalets (Tree House Chalets)", ts: "09:39:06", color: "#34d399" },
    { action: "Agent created", detail: "Added Chanya (chanya@…) to Tree House Chalets", ts: "09:38:33", color: "#00d4ff" },
    { action: "Client activated", detail: "Winrich Hotel moved to Scale plan", ts: "08:12:50", color: "#34d399" },
    { action: "Payment received", detail: "$1,990 · Tree House Chalets", ts: "Yesterday", color: "#7b61ff" },
    { action: "Trial started", detail: "Aether Labs began a 14-day trial", ts: "2d ago", color: "#f59e0b" }
  ],
  ADMIN_USERS: [
    { id: "adm_maya", name: "Maya Reyes", email: "maya@taskforceai.tech", role: "super_admin", status: "active", isActive: true, color: "#7b61ff", initials: "MR", lastLoginLabel: "Today" },
    { id: "adm_chrys", name: "Chrys Fernando", email: "chrys@taskforceai.tech", role: "super_admin", status: "active", isActive: true, color: "#00d4ff", initials: "CF", lastLoginLabel: "Today" }
  ],
  SERVICES: [
    { name: "API", status: "operational", value: 99.98 },
    { name: "Voice gateway", status: "operational", value: 99.95 },
    { name: "Dashboard", status: "operational", value: 100 },
    { name: "Webhooks", status: "operational", value: 99.92 }
  ],
  AGENT_TEMPLATES: [
    { name: "Booking Agent", label: "Booking", count: 4, value: 4 },
    { name: "Support Agent", label: "Support", count: 2, value: 2 },
    { name: "Sales Agent", label: "Sales", count: 1, value: 1 }
  ],
  PAYMENTS: [],
  OVERDUE: [],
  TICKETS: [],
  INCIDENTS: [],
  CLIENT_INVOICES: [],
  AUDIT_LOG: [
    { action: "agent.create", summary: "Reset password · chanya@treehousechalets", admin: { name: "Maya Reyes" }, occurredLabel: "09:39:06" },
    { action: "agent.create", summary: "Added Chanya to Tree House Chalets", admin: { name: "Maya Reyes" }, occurredLabel: "09:38:33" },
    { action: "client.activate", summary: "Winrich Hotel moved to Scale plan", admin: { name: "Chrys Fernando" }, occurredLabel: "08:12:50" }
  ]
};

const PLATFORM_NAME = "Sentinel";

const CLIENTS = [];
const REVENUE_TREND = [];
const CLIENT_BREAKDOWN = [];
const ACTIVITY_FEED = [];
const PAYMENTS = [];
const OVERDUE = [];
const TICKETS = [];
const AUDIT_LOG = [];
const ADMIN_USERS = [];
const SERVICES = [];
const INCIDENTS = [];
const AGENT_TEMPLATES = [];
const EARNINGS_MONTHLY = [];
const REVENUE_BY_PLAN = [];
const MRR_MOVEMENT = [];
const CLIENT_INVOICES = [];

const fmtMoney = (n) => "$" + Math.round(Math.abs(n)).toLocaleString();
const fmtMoneySigned = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString();
const fmtAbbrev = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
};
const fmtPct = (n, decimals = 1) => n.toFixed(decimals) + "%";
const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysAgo = (n) => `${n}d ago`;

(function applyLive() {
  var live = window.__LIVE_ADMIN || {};
  var base = {
    PLATFORM_NAME: PLATFORM_NAME, CLIENTS: CLIENTS, REVENUE_TREND: REVENUE_TREND,
    CLIENT_BREAKDOWN: CLIENT_BREAKDOWN, ACTIVITY_FEED: ACTIVITY_FEED,
    PAYMENTS: PAYMENTS, OVERDUE: OVERDUE, TICKETS: TICKETS, AUDIT_LOG: AUDIT_LOG,
    ADMIN_USERS: ADMIN_USERS, SERVICES: SERVICES, INCIDENTS: INCIDENTS,
    AGENT_TEMPLATES: AGENT_TEMPLATES, EARNINGS_MONTHLY: EARNINGS_MONTHLY,
    REVENUE_BY_PLAN: REVENUE_BY_PLAN, MRR_MOVEMENT: MRR_MOVEMENT,
    CLIENT_INVOICES: CLIENT_INVOICES,
  };
  for (var k in base) {
    var liveVal = live[k];
    window[k] = (liveVal != null) ? liveVal : base[k];
  }
  Object.assign(window, { fmtMoney: fmtMoney, fmtMoneySigned: fmtMoneySigned, fmtAbbrev: fmtAbbrev, fmtPct: fmtPct, formatDate: formatDate, daysAgo: daysAgo });
})();
