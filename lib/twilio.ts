const TWILIO_HOST = "https://api.twilio.com";
const TWILIO_BASE = TWILIO_HOST + "/2010-04-01";

export type DisplayCall = {
  id: string;
  caller: string;
  number: string;
  startedAt: string;
  startedAtIso: string;
  duration: string;
  durationSec: number;
  outcome: string; // real Twilio call status, prettified (e.g. "Completed", "No answer")
  sentiment: "positive" | "neutral" | "negative";
  direction: "inbound" | "outbound";
  recordingUrl?: string | null;
  twilioPriceUsd: number | null; // absolute USD charge Twilio billed for this one call (null if not yet posted)
  twilioPriceUnit?: string; // typically "USD"
};

export type CallsResult = {
  calls: DisplayCall[];
  configured: boolean;
  error?: string;
};

export type UsageResult = {
  configured: boolean;
  totalCalls: number;
  totalMinutes: number;
  totalPrice: number;
  error?: string;
};

// Auth (parent account) is enough to query any subaccount under it.
export function isTwilioAuthConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function isTwilioConfigured() {
  return isTwilioAuthConfigured() && !!process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID;
}

function authHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function twilioGetUrl(url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio ${res.status}: ${body.slice(0, 240)}`);
  }
  return res.json();
}

function twilioGet(path: string) {
  return twilioGetUrl(`${TWILIO_BASE}${path}`);
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (d >= todayStart) {
    return "Today, " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d >= yesterday) return "Yesterday";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} days ago`;
  return d.toLocaleDateString();
}

// Absolute "YYYY-MM-DD HH:MM:SS" formatted in the configured display
// timezone (defaults to Asia/Colombo). Professional, unambiguous, no
// relative wording. Used for call logs, billing, analytics.
export function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const tz = process.env.DISPLAY_TIMEZONE || "Asia/Colombo";
  // sv-SE locale produces ISO-like output ("YYYY-MM-DD HH:MM:SS") in any tz.
  return d.toLocaleString("sv-SE", { timeZone: tz });
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  "no-answer": "No answer",
  busy: "Busy",
  failed: "Failed",
  canceled: "Canceled",
  "in-progress": "In progress",
  ringing: "Ringing",
  queued: "Queued",
};

function prettyStatus(status: string): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

type TwilioCall = {
  sid: string;
  from: string;
  from_formatted: string;
  to: string;
  to_formatted: string;
  direction: string;
  status: string;
  duration: string;
  start_time: string;
  price?: string | null; // negative string like "-0.00850" once billing is processed; null while pending
  price_unit?: string | null; // "USD"
};

function mapCall(c: TwilioCall): DisplayCall {
  const dur = parseInt(c.duration || "0", 10);
  const direction = (c.direction || "").startsWith("inbound") ? "inbound" : "outbound";
  const other = direction === "inbound" ? c.from_formatted || c.from : c.to_formatted || c.to;
  // Twilio returns price as a negative string (debit); store the absolute
  // value so the UI can render "USD 0.0085" instead of "-0.0085". Null if
  // billing hasn't posted yet (typically a few minutes after the call ends).
  const rawPrice = c.price != null ? parseFloat(c.price) : NaN;
  const twilioPriceUsd = Number.isFinite(rawPrice) ? Math.abs(rawPrice) : null;
  return {
    id: c.sid,
    caller: other,
    number: other,
    startedAt: formatTs(c.start_time),
    startedAtIso: c.start_time,
    duration: formatDuration(dur),
    durationSec: dur,
    outcome: prettyStatus(c.status),
    sentiment: "neutral",
    direction,
    twilioPriceUsd,
    twilioPriceUnit: c.price_unit || undefined,
  };
}

// Default (workspace) subaccount used by the client-portal pages.
function defaultSub() {
  return process.env.TWILIO_TREEHOUSE_SUBACCOUNT_SID || "";
}

export async function getCalls(limit = 50): Promise<CallsResult> {
  return getCallsForSubaccount(defaultSub(), limit);
}

export async function getCallsForSubaccount(sub: string, limit = 50): Promise<CallsResult> {
  if (!isTwilioAuthConfigured() || !sub) return { calls: [], configured: false };
  try {
    const data = await twilioGet(`/Accounts/${sub}/Calls.json?PageSize=${limit}`);
    const raw = (data.calls ?? []) as TwilioCall[];
    return { calls: raw.map(mapCall), configured: true };
  } catch (e) {
    return { calls: [], configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}

// Paginated fetch (follows next_page_uri) with optional StartTime range.
// Dates are YYYY-MM-DD (GMT). Caps total at `max` to bound payloads.
export async function getAllCallsForSubaccount(
  sub: string,
  opts: { max?: number; startDate?: string; endDate?: string } = {}
): Promise<CallsResult> {
  if (!isTwilioAuthConfigured() || !sub) return { calls: [], configured: false };
  const max = opts.max ?? 1000;
  let path = `/Accounts/${sub}/Calls.json?PageSize=200`;
  if (opts.startDate) path += `&StartTime>=${opts.startDate}`;
  if (opts.endDate) path += `&StartTime<=${opts.endDate}`;
  let url: string | null = TWILIO_BASE + path;
  const out: DisplayCall[] = [];
  try {
    while (url && out.length < max) {
      const data = await twilioGetUrl(url);
      const raw = (data.calls ?? []) as TwilioCall[];
      for (const c of raw) {
        out.push(mapCall(c));
        if (out.length >= max) break;
      }
      url = data.next_page_uri ? TWILIO_HOST + data.next_page_uri : null;
    }
    return { calls: out, configured: true };
  } catch (e) {
    return { calls: out, configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}

// Calls bucketed per day across an explicit [startMs, endMs] window.
export function bucketCallsByDayRange(calls: DisplayCall[], startMs: number, endMs: number) {
  const dayMs = 86400000;
  const start = new Date(startMs);
  start.setHours(0, 0, 0, 0);
  const buckets: { key: string; label: string; value: number }[] = [];
  for (let t = start.getTime(); t <= endMs && buckets.length < 120; t += dayMs) {
    const d = new Date(t);
    buckets.push({ key: d.toDateString(), label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const c of calls) {
    if (!c.startedAtIso) continue;
    const d = new Date(c.startedAtIso);
    if (isNaN(d.getTime())) continue;
    const b = map.get(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString());
    if (b) b.value++;
  }
  return buckets.map((b) => ({ label: b.label, value: b.value }));
}

export async function getUsageThisMonth(): Promise<UsageResult> {
  return getUsageForSubaccount(defaultSub());
}

export async function getUsageForSubaccount(sub: string): Promise<UsageResult> {
  if (!isTwilioAuthConfigured() || !sub) {
    return { configured: false, totalCalls: 0, totalMinutes: 0, totalPrice: 0 };
  }
  try {
    const data = await twilioGet(
      `/Accounts/${sub}/Usage/Records/ThisMonth.json?Category=calls`
    );
    const records = (data.usage_records ?? []) as Array<{
      count: string;
      usage: string;
      usage_unit: string;
      price: string;
    }>;
    let totalCalls = 0;
    let totalMinutes = 0;
    let totalPrice = 0;
    for (const r of records) {
      totalCalls += parseInt(r.count || "0", 10);
      const usage = parseFloat(r.usage || "0");
      totalMinutes += r.usage_unit === "minutes" ? usage : usage / 60;
      totalPrice += parseFloat(r.price || "0");
    }
    return { configured: true, totalCalls, totalMinutes, totalPrice };
  } catch (e) {
    return {
      configured: true,
      totalCalls: 0,
      totalMinutes: 0,
      totalPrice: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function bucketCallsByHour(calls: DisplayCall[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byHour = new Map<number, number>();
  for (const c of calls) {
    if (!c.startedAtIso) continue;
    const d = new Date(c.startedAtIso);
    if (isNaN(d.getTime()) || d < today) continue;
    const h = d.getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  return hours.map((h) => ({
    hour: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
    calls: (byHour.get(h) ?? 0) + (byHour.get(h - 1) ?? 0),
  }));
}

export function bucketCallsByDay(calls: DisplayCall[]) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const buckets: { day: string; calls: number; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({ day: labels[d.getDay()], calls: 0, date: d });
  }
  for (const c of calls) {
    if (!c.startedAtIso) continue;
    const d = new Date(c.startedAtIso);
    if (isNaN(d.getTime())) continue;
    for (const b of buckets) {
      const next = new Date(b.date);
      next.setDate(next.getDate() + 1);
      if (d >= b.date && d < next) {
        b.calls += 1;
        break;
      }
    }
  }
  return buckets.map(({ day, calls }) => ({ day, calls }));
}

export function bucketOutcomes(calls: DisplayCall[]) {
  const colors: Record<string, string> = {
    Completed: "#34D399",
    "In progress": "#22D3EE",
    Busy: "#FBBF24",
    "No answer": "#94A3B8",
    Failed: "#FB7185",
    Canceled: "#FB7185",
    "Handed over": "#A78BFA",
  };
  const counts = new Map<string, number>();
  for (const c of calls) {
    counts.set(c.outcome, (counts.get(c.outcome) ?? 0) + 1);
  }
  // Always surface "Handed over" as its own row, even with zero calls, so the
  // client sees the category exists. It populates once handover-keyword
  // detection finds matching transcripts.
  if (!counts.has("Handed over")) counts.set("Handed over", 0);
  return Array.from(counts.entries()).map(([outcome, count]) => ({
    outcome,
    count,
    color: colors[outcome] ?? "#22D3EE",
  }));
}

export function callsToday(calls: DisplayCall[]) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return calls.filter((c) => {
    if (!c.startedAtIso) return false;
    const d = new Date(c.startedAtIso);
    return !isNaN(d.getTime()) && d >= todayStart;
  });
}

export function callStats(calls: DisplayCall[]) {
  const total = calls.length;
  const completed = calls.filter((c) => c.outcome === "Completed").length;
  const completionRate = total ? Math.round((completed / total) * 1000) / 10 : 0;
  const avgSec = total ? Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / total) : 0;
  const avgDuration = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, "0")}`;
  return { total, completed, completionRate, avgSec, avgDuration };
}

// ===== Twilio Usage Records (aggregated billing) =====
// Hits /2010-04-01/Accounts/{SubSid}/Usage/Records.json. Returns what
// Twilio actually charged this subaccount per category for the chosen
// window. We use it to surface the master cost in the admin Billing tab
// alongside our flat Rs.3/min invoice so the operator can see margin.

export type UsageCategory = {
  category: string; // e.g. "calls-inbound-local", "phonenumbers", "totalprice"
  description: string;
  count: number;       // number of items (calls / numbers / etc.)
  countUnit: string;   // "calls", "numbers", ""
  usage: number;       // quantity used (minutes, etc.)
  usageUnit: string;   // "minutes", "numbers", "usd"
  priceUsd: number;    // absolute USD charge for this category
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
};

export type UsageRecordsResult = {
  configured: boolean;
  error?: string | null;
  subaccount?: string;
  startDate: string | null;
  endDate: string | null;
  totalUsd: number;
  categories: UsageCategory[];
};

type TwilioUsageRow = {
  category: string;
  description?: string;
  count?: string | null;
  count_unit?: string | null;
  usage?: string | null;
  usage_unit?: string | null;
  price?: string | null;
  price_unit?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export async function getUsageRecordsForSubaccount(
  sub: string,
  opts: { startDate?: string; endDate?: string; category?: string } = {},
): Promise<UsageRecordsResult> {
  if (!isTwilioAuthConfigured() || !sub) {
    return { configured: false, startDate: null, endDate: null, totalUsd: 0, categories: [] };
  }
  const params = new URLSearchParams({ PageSize: "100" });
  if (opts.startDate) params.set("StartDate", opts.startDate);
  if (opts.endDate) params.set("EndDate", opts.endDate);
  if (opts.category) params.set("Category", opts.category);
  try {
    const all: TwilioUsageRow[] = [];
    let url = `${TWILIO_BASE}/Accounts/${sub}/Usage/Records.json?${params.toString()}`;
    // Cursor-paginate via next_page_uri so we don't miss rows when an
    // agent has many active categories.
    for (let i = 0; i < 10; i++) { // safety cap
      const data = await twilioGetUrl(url) as { usage_records?: TwilioUsageRow[]; next_page_uri?: string | null };
      if (data && Array.isArray(data.usage_records)) all.push(...data.usage_records);
      const next = data?.next_page_uri;
      if (!next) break;
      url = TWILIO_HOST + next;
    }
    const categories: UsageCategory[] = all.map((r) => ({
      category: r.category,
      description: r.description || r.category,
      count: Number.parseFloat(r.count || "0") || 0,
      countUnit: r.count_unit || "",
      usage: Number.parseFloat(r.usage || "0") || 0,
      usageUnit: r.usage_unit || "",
      priceUsd: Math.abs(Number.parseFloat(r.price || "0") || 0),
      startDate: r.start_date || "",
      endDate: r.end_date || "",
    }));
    const totalRow = categories.find((c) => c.category === "totalprice");
    const totalUsd = totalRow
      ? totalRow.priceUsd
      // Fallback when the master account hasn't aggregated totalprice yet —
      // sum non-aggregate-ish rows. Excludes totalprice itself if present.
      : categories.filter((c) => c.category !== "totalprice").reduce((s, c) => s + c.priceUsd, 0);
    return {
      configured: true,
      subaccount: sub,
      startDate: opts.startDate || null,
      endDate: opts.endDate || null,
      totalUsd,
      categories,
    };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? e.message : "Twilio usage fetch failed",
      startDate: opts.startDate || null,
      endDate: opts.endDate || null,
      totalUsd: 0,
      categories: [],
    };
  }
}
