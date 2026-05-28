/* ============================================================
   Sentinel Super Admin Console — live data wiring
   All UI data comes from /api/admin/sentinel-bundle (DB-backed).
   No hardcoded fallbacks; if the API is unavailable the UI shows empty state.
   ============================================================ */
(function bootstrapLiveData() {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/admin/sentinel-bundle', false);
    xhr.withCredentials = true;
    xhr.send(null);
    if (xhr.status === 401) {
      window.location.href = '/admin/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    if (xhr.status >= 200 && xhr.status < 300) {
      window.__LIVE_ADMIN = JSON.parse(xhr.responseText);
      console.info('[sentinel] loaded live data');
    } else {
      console.warn('[sentinel] live bundle request returned', xhr.status, '— rendering empty state');
    }
  } catch (e) {
    console.warn('[sentinel] live bundle fetch failed — rendering empty state:', e.message);
  }
})();

const PLATFORM_NAME = "Sentinel";

// All collections start empty; populated entirely from the live bundle.
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

/* ============================================================
   HELPERS
   ============================================================ */

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

// Project live data onto the globals the UI components read.
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
