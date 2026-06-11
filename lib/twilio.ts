const TWILIO_HOST = "https://api.twilio.com";
const TWILIO_BASE = TWILIO_HOST + "/2010-04-01";

// Cheap server-side cache for Twilio API responses, scoped per Vercel
// function instance. Twilio's REST API takes 0.5–3s per call and most
// client-portal pages need the same call list, so without caching every
// tab navigation re-fetches everything. 30s TTL is short enough that a
// new call appears within half a minute on AutoRefresh-enabled tabs.
type CacheEntry<T> = { value: T; expiresAt: number };
const __cache = new Map<string, CacheEntry<unknown>>();
const TWILIO_CACHE_TTL_MS = 30_000;

function cacheKey(parts: (string | number | undefined)[]): string {
  return parts.map((p) => (p === undefined ? "_" : String(p))).join("|");
}

async function memoize<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = __cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await fn();
  __cache.set(key, { value, expiresAt: now + ttlMs });
  // Soft cap to avoid unbounded growth in long-lived warm instances.
  if (__cache.size > 500) {
    for (const k of __cache.keys()) { __cache.delete(k); if (__cache.size <= 250) break; }
  }
  return value;
}

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
  return memoize(cacheKey(["calls", sub, max, opts.startDate, opts.endDate]), TWILIO_CACHE_TTL_MS, async () => {
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
  });
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

// Top-level Twilio rollups that aggregate across everything. We always
// strip these from the response (they'd cause visual double-count next
// to the leaves and they include non-call charges anyway). NOT included:
// "calls-inbound" / "calls-outbound" / "calls-client" — those are
// call-direction rollups that the consumer keeps so it can decide
// whether to show them when no leaf children are present.
const TWILIO_GLOBAL_ROLLUPS = new Set([
  "totalprice",
  "calls",
  "voice",
]);
function isTwilioGlobalRollup(cat: string): boolean {
  return TWILIO_GLOBAL_ROLLUPS.has(cat);
}

// Categories that map 1:1 to the per-minute call traffic our invoice
// charges for. Anything else (Conversation Relay, Voice Insights, phone
// number rentals, recordings, transcriptions, TTS, Media Streams) is a
// Twilio add-on cost that's not invoiced and should be excluded from the
// margin comparison.
export function isCallBillingCategory(cat: string): boolean {
  return (
    cat === "calls-inbound" ||
    cat === "calls-outbound" ||
    cat === "calls-client" ||
    cat.startsWith("calls-inbound-") ||
    cat.startsWith("calls-outbound-") ||
    cat.startsWith("calls-client-")
  );
}

// True when this row is a direction-rollup (calls-inbound, calls-outbound,
// calls-client) that already sums its own children.
export function isCallDirectionRollup(cat: string): boolean {
  return cat === "calls-inbound" || cat === "calls-outbound" || cat === "calls-client";
}

export async function getUsageRecordsForSubaccount(
  sub: string,
  opts: { startDate?: string; endDate?: string; category?: string } = {},
): Promise<UsageRecordsResult> {
  if (!isTwilioAuthConfigured() || !sub) {
    return { configured: false, startDate: null, endDate: null, totalUsd: 0, categories: [] };
  }
  return memoize(cacheKey(["usage", sub, opts.startDate, opts.endDate, opts.category]), TWILIO_CACHE_TTL_MS, () => fetchUsageRecordsImpl(sub, opts));
}

async function fetchUsageRecordsImpl(
  sub: string,
  opts: { startDate?: string; endDate?: string; category?: string },
): Promise<UsageRecordsResult> {
  // IMPORTANT: Twilio's default /Usage/Records.json returns AllTime
  // aggregates and silently IGNORES StartDate/EndDate. To get a real
  // date-filtered view we have to use the /Daily.json sub-resource and
  // sum the daily rows by category ourselves. When the caller asks for
  // no date range, we use /AllTime.json explicitly so the response is
  // unambiguous.
  const hasRange = !!(opts.startDate && opts.endDate);
  const endpointPath = hasRange
    ? `/Accounts/${sub}/Usage/Records/Daily.json`
    : `/Accounts/${sub}/Usage/Records/AllTime.json`;
  const params = new URLSearchParams({ PageSize: "1000" });
  if (hasRange) {
    params.set("StartDate", opts.startDate!);
    params.set("EndDate", opts.endDate!);
  }
  if (opts.category) params.set("Category", opts.category);

  try {
    const rawRows: TwilioUsageRow[] = [];
    let url = `${TWILIO_BASE}${endpointPath}?${params.toString()}`;
    // Cursor-paginate. Daily-granularity over a 30-day window with many
    // categories can easily exceed one page.
    for (let i = 0; i < 20; i++) {
      const data = await twilioGetUrl(url) as { usage_records?: TwilioUsageRow[]; next_page_uri?: string | null };
      if (data && Array.isArray(data.usage_records)) rawRows.push(...data.usage_records);
      const next = data?.next_page_uri;
      if (!next) break;
      url = TWILIO_HOST + next;
    }
    // Aggregate by category — daily mode returns one row per (category, day)
    // so we sum count/usage/priceUsd to collapse to one row per category.
    const aggregated = new Map<string, UsageCategory>();
    for (const r of rawRows) {
      const cat = r.category;
      const count = Number.parseFloat(r.count || "0") || 0;
      const usage = Number.parseFloat(r.usage || "0") || 0;
      const priceUsd = Math.abs(Number.parseFloat(r.price || "0") || 0);
      const existing = aggregated.get(cat);
      if (existing) {
        existing.count += count;
        existing.usage += usage;
        existing.priceUsd += priceUsd;
        // Keep the earliest startDate / latest endDate seen for the bucket.
        if (r.start_date && (!existing.startDate || r.start_date < existing.startDate)) existing.startDate = r.start_date;
        if (r.end_date && (!existing.endDate || r.end_date > existing.endDate)) existing.endDate = r.end_date;
      } else {
        aggregated.set(cat, {
          category: cat,
          description: r.description || cat,
          count,
          countUnit: r.count_unit || "",
          usage,
          usageUnit: r.usage_unit || "",
          priceUsd,
          startDate: r.start_date || "",
          endDate: r.end_date || "",
        });
      }
    }
    const allCategories = Array.from(aggregated.values());
    const totalRow = allCategories.find((c) => c.category === "totalprice");
    // Strip the global "everything" rollups (totalprice / voice / calls).
    // The consumer (getTwilioCostForAgent) handles call-specific filtering
    // and parent-child de-duplication.
    const usableCategories = allCategories
      .filter((c) => !isTwilioGlobalRollup(c.category))
      .sort((a, b) => b.priceUsd - a.priceUsd);
    const totalUsd = totalRow
      ? totalRow.priceUsd
      // No totalprice row — sum non-rollup-able rows. (Direction rollups
      // are kept above; we exclude them here to avoid double-count.)
      : usableCategories.filter((c) => !isCallDirectionRollup(c.category)).reduce((s, c) => s + c.priceUsd, 0);
    return {
      configured: true,
      subaccount: sub,
      startDate: opts.startDate || null,
      endDate: opts.endDate || null,
      totalUsd,
      categories: usableCategories,
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
