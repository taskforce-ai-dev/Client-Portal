/* ============================================================
   Sentinel Super Admin Console — data wiring
   Data is baked in here (shapes match the reference sentinel-bundle
   builder exactly) so the console renders without a runtime API call.
   Swap window.__LIVE_ADMIN for a fetch when a backend is wired up.
   ============================================================ */
window.__LIVE_ADMIN = (function () {
  var months = [];
  for (var i = 11; i >= 0; i--) {
    var d = new Date(Date.UTC(2026, 4 - i, 1));
    months.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '"));
  }
  var curve = [0, 0, 0, 0, 120, 360, 720, 1200, 1850, 2600, 3500, 4446];

  var REVENUE_TREND = months.map(function (m, i) {
    return { month: m, mrr: curve[i], collected: Math.round(curve[i] * 0.92) };
  });

  var EARNINGS_MONTHLY = months.map(function (m, i) {
    var invoiced = curve[i];
    var collected = Math.round(curve[i] * 0.92);
    return {
      month: m,
      clients: Math.min(5, Math.max(0, Math.round((i - 3) * 0.8))),
      newClients: i >= 8 ? 1 : 0,
      churned: 0,
      invoiced: invoiced,
      collected: collected,
      outstanding: invoiced - collected,
      netMrr: curve[i],
    };
  });

  var CLIENTS = [
    { id: "TH-1042", workspaceId: "ws_treehouse", company: "Tree House Chalets", contact: "Chrys Fernando", email: "hello@treehousechalets.com", country: "LK", plan: "Growth", status: "Active", mrr: 1990, totalPaid: 5970, agents: 1, joined: "2026-03-12", lastActive: "2h ago", phone: "+94 71 707 3529", timezone: "Asia/Colombo" },
    { id: "WR-1039", workspaceId: "ws_winrich", company: "Winrich Hotel", contact: "Ops Team", email: "ops@winrich.com", country: "LK", plan: "Scale", status: "Active", mrr: 1480, totalPaid: 4440, agents: 2, joined: "2026-02-02", lastActive: "5h ago", phone: "—", timezone: "Asia/Colombo" },
    { id: "FL-1051", workspaceId: "ws_flico", company: "Flico", contact: "Flico Team", email: "team@flico.io", country: "US", plan: "Starter", status: "Active", mrr: 976, totalPaid: 2928, agents: 1, joined: "2026-04-18", lastActive: "1d ago", phone: "—", timezone: "UTC" },
    { id: "AE-1063", workspaceId: "ws_aether", company: "Aether Labs", contact: "Founder", email: "founder@aether.ai", country: "US", plan: "Trial", status: "Trial", mrr: 0, totalPaid: 0, agents: 1, joined: "2026-05-20", lastActive: "3h ago", phone: "—", timezone: "UTC" },
    { id: "NW-1009", workspaceId: "ws_northwind", company: "Northwind Co", contact: "Admin", email: "admin@northwind.co", country: "GB", plan: "Growth", status: "Blocked", mrr: 0, totalPaid: 1990, agents: 0, joined: "2025-11-21", lastActive: "21d ago", phone: "—", timezone: "Europe/London" },
  ];

  var CLIENT_BREAKDOWN = [
    { name: "Active", count: 3, color: "#10b981" },
    { name: "Trial", count: 1, color: "#f59e0b" },
    { name: "Overdue", count: 0, color: "#f43f5e" },
    { name: "Blocked", count: 1, color: "#6b7280" },
    { name: "Churned", count: 0, color: "#4b5563" },
  ];

  var ACTIVITY_FEED = [
    { ts: "09:39:06", action: "agent_created", client: "Tree House Chalets", detail: "Reset password · chanya@treehousechalets" },
    { ts: "09:38:33", action: "agent_created", client: "Tree House Chalets", detail: "Added Chanya to Tree House Chalets" },
    { ts: "08:12:50", action: "plan_upgrade", client: "Winrich Hotel", detail: "Moved to Scale plan" },
    { ts: "07:50:11", action: "payment_received", client: "Tree House Chalets", detail: "$1,990 received" },
    { ts: "06:30:00", action: "signup", client: "Aether Labs", detail: "Started 14-day trial" },
    { ts: "Yesterday", action: "ticket_opened", client: "Winrich Hotel", detail: "Voice latency question" },
  ];

  var PAYMENTS = [
    { id: "P-2041", client: "Tree House Chalets", date: "2026-05-01", amount: 1990, plan: "Growth", method: "—", status: "Paid" },
    { id: "P-2042", client: "Winrich Hotel", date: "2026-05-01", amount: 1480, plan: "Scale", method: "—", status: "Paid" },
    { id: "P-2043", client: "Flico", date: "2026-05-12", amount: 976, plan: "Starter", method: "—", status: "Pending" },
  ];

  var ADMIN_USERS = [
    { name: "Maya Reyes", email: "maya@taskforceai.tech", role: "Super Admin", lastLogin: "Today", status: "Active" },
    { name: "Chrys Fernando", email: "chrys@taskforceai.tech", role: "Super Admin", lastLogin: "Today", status: "Active" },
  ];

  var SERVICES = [
    { name: "API", status: "Operational", uptime: 99.98, latency: 142, lastIncident: "—" },
    { name: "Voice gateway", status: "Operational", uptime: 99.95, latency: 88, lastIncident: "12d ago" },
    { name: "Dashboard", status: "Operational", uptime: 100, latency: 60, lastIncident: "—" },
    { name: "Webhooks", status: "Operational", uptime: 99.92, latency: 210, lastIncident: "—" },
  ];

  var AGENT_TEMPLATES = [
    { id: "growth", name: "Booking Agent", description: "Calendar reservations & confirmations", model: "balanced", voice: "Nova", channel: "voice", voiceCost: 0.1, aiCost: 0.002, callCost: 0.12, active: true },
    { id: "scale", name: "Support Agent", description: "Inbound resolution & customer care", model: "quality", voice: "Aria", channel: "voice", voiceCost: 0.12, aiCost: 0.003, callCost: 0.14, active: true },
    { id: "starter", name: "Sales Agent", description: "Outbound conversion & pipeline", model: "fast", voice: "Rex", channel: "voice", voiceCost: 0.09, aiCost: 0.002, callCost: 0.1, active: true },
  ];

  var REVENUE_BY_PLAN = [
    { plan: "Growth", revenue: 1990 },
    { plan: "Scale", revenue: 1480 },
    { plan: "Starter", revenue: 976 },
  ];

  var MRR_MOVEMENT = [
    { kind: "New", value: 976, color: "#10b981" },
    { kind: "Expansion", value: 490, color: "#34d399" },
    { kind: "Contraction", value: 0, color: "#f59e0b" },
    { kind: "Churned", value: 0, color: "#f43f5e" },
  ];

  var AUDIT_LOG = [
    { ts: "2026-05-28 09:39:06", admin: "Maya Reyes", action: "Agent Create", type: "agent", target: "Tree House Chalets", ip: "—", details: "Reset password · chanya@treehousechalets" },
    { ts: "2026-05-28 09:38:33", admin: "Maya Reyes", action: "Agent Create", type: "agent", target: "Tree House Chalets", ip: "—", details: "Added Chanya to Tree House Chalets" },
    { ts: "2026-05-28 08:12:50", admin: "Chrys Fernando", action: "Client Activate", type: "client", target: "Winrich Hotel", ip: "—", details: "Moved to Scale plan" },
  ];

  var CLIENT_INVOICES = [
    { id: "INV-2041", date: "2026-05-01", amount: 1990, status: "Paid" },
    { id: "INV-2042", date: "2026-05-01", amount: 1480, status: "Paid" },
    { id: "INV-2043", date: "2026-05-12", amount: 976, status: "Pending" },
  ];

  return {
    PLATFORM_NAME: "Sentinel",
    CLIENTS: CLIENTS,
    REVENUE_TREND: REVENUE_TREND,
    CLIENT_BREAKDOWN: CLIENT_BREAKDOWN,
    ACTIVITY_FEED: ACTIVITY_FEED,
    PAYMENTS: PAYMENTS,
    OVERDUE: [],
    TICKETS: [],
    AUDIT_LOG: AUDIT_LOG,
    ADMIN_USERS: ADMIN_USERS,
    SERVICES: SERVICES,
    INCIDENTS: [],
    AGENT_TEMPLATES: AGENT_TEMPLATES,
    EARNINGS_MONTHLY: EARNINGS_MONTHLY,
    REVENUE_BY_PLAN: REVENUE_BY_PLAN,
    MRR_MOVEMENT: MRR_MOVEMENT,
    CLIENT_INVOICES: CLIENT_INVOICES,
    announcements: [],
  };
})();

// Override the baked demo with live DB-backed data when the API has it.
// Falls back to the baked data on any error so the console never blanks.
try {
  var __xhr = new XMLHttpRequest();
  __xhr.open("GET", "/api/admin/sentinel-bundle", false);
  __xhr.withCredentials = true;
  __xhr.send(null);
  if (__xhr.status >= 200 && __xhr.status < 300) {
    var __live = JSON.parse(__xhr.responseText);
    if (__live && Array.isArray(__live.CLIENTS)) window.__LIVE_ADMIN = __live;
  }
} catch (e) {}

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
const announcements = [];

const fmtMoney = (n) => "$" + Math.round(Math.abs(n || 0)).toLocaleString();
const fmtMoneySigned = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n || 0)).toLocaleString();
const fmtAbbrev = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n || 0).toLocaleString();
};
const fmtPct = (n, decimals = 1) => (n || 0).toFixed(decimals) + "%";
const formatDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysAgo = (n) => `${n}d ago`;

(function applyLive() {
  var live = window.__LIVE_ADMIN || {};
  Object.keys(live).forEach(function (k) { window[k] = live[k]; });
  Object.assign(window, { fmtMoney: fmtMoney, fmtMoneySigned: fmtMoneySigned, fmtAbbrev: fmtAbbrev, fmtPct: fmtPct, formatDate: formatDate, daysAgo: daysAgo });
})();
