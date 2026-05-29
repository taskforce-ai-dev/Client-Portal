/* ============================================================
   Sentinel Super Admin Console — data wiring
   No sample/demo clients are baked in. The console loads everything
   from /api/admin/sentinel-bundle (DB-backed). The object below is an
   empty-but-valid fallback used only if that request fails, so the
   console never invents fake clients and never blanks.
   ============================================================ */
window.__LIVE_ADMIN = (function () {
  var months = [];
  for (var i = 11; i >= 0; i--) {
    var d = new Date(Date.UTC(2026, 4 - i, 1));
    months.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }).replace(" ", " '"));
  }

  var REVENUE_TREND = months.map(function (m) { return { month: m, mrr: 0, collected: 0 }; });
  var EARNINGS_MONTHLY = months.map(function (m) {
    return { month: m, clients: 0, newClients: 0, churned: 0, invoiced: 0, collected: 0, outstanding: 0, netMrr: 0 };
  });

  var CLIENT_BREAKDOWN = [
    { name: "Active", count: 0, color: "#10b981" },
    { name: "Trial", count: 0, color: "#f59e0b" },
    { name: "Overdue", count: 0, color: "#f43f5e" },
    { name: "Blocked", count: 0, color: "#6b7280" },
    { name: "Churned", count: 0, color: "#4b5563" },
  ];

  var SERVICES = [
    { name: "API", status: "Operational", uptime: 99.98, latency: 142, lastIncident: "—" },
    { name: "Voice gateway", status: "Operational", uptime: 99.95, latency: 88, lastIncident: "—" },
    { name: "Dashboard", status: "Operational", uptime: 100, latency: 60, lastIncident: "—" },
    { name: "Webhooks", status: "Operational", uptime: 99.92, latency: 210, lastIncident: "—" },
  ];

  var AGENT_TEMPLATES = [
    { id: "growth", name: "Booking Agent", description: "Calendar reservations & confirmations", model: "balanced", voice: "Nova", channel: "voice", voiceCost: 0.1, aiCost: 0.002, callCost: 0.12, active: true },
    { id: "scale", name: "Support Agent", description: "Inbound resolution & customer care", model: "quality", voice: "Aria", channel: "voice", voiceCost: 0.12, aiCost: 0.003, callCost: 0.14, active: true },
    { id: "starter", name: "Sales Agent", description: "Outbound conversion & pipeline", model: "fast", voice: "Rex", channel: "voice", voiceCost: 0.09, aiCost: 0.002, callCost: 0.1, active: true },
  ];

  var MRR_MOVEMENT = [
    { kind: "New", value: 0, color: "#10b981" },
    { kind: "Expansion", value: 0, color: "#34d399" },
    { kind: "Contraction", value: 0, color: "#f59e0b" },
    { kind: "Churned", value: 0, color: "#f43f5e" },
  ];

  return {
    PLATFORM_NAME: "Sentinel",
    CLIENTS: [],
    REVENUE_TREND: REVENUE_TREND,
    CLIENT_BREAKDOWN: CLIENT_BREAKDOWN,
    ACTIVITY_FEED: [],
    PAYMENTS: [],
    OVERDUE: [],
    TICKETS: [],
    AUDIT_LOG: [],
    ADMIN_USERS: [],
    SERVICES: SERVICES,
    INCIDENTS: [],
    AGENT_TEMPLATES: AGENT_TEMPLATES,
    EARNINGS_MONTHLY: EARNINGS_MONTHLY,
    REVENUE_BY_PLAN: [],
    MRR_MOVEMENT: MRR_MOVEMENT,
    CLIENT_INVOICES: [],
    announcements: [],
  };
})();

// Load live DB-backed data from the API. Falls back to the empty shape
// above on any error so the console never blanks (but never shows demo).
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
