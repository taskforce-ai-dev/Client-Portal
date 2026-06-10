import { DbAgent, getSetting, getSql, setSetting } from "./adminDb";
import {
  getAllCallsForSubaccount,
  getUsageRecordsForSubaccount,
  isCallBillingCategory,
  isCallDirectionRollup,
  isTwilioAuthConfigured,
  type UsageCategory,
} from "./twilio";

// Single source of truth for the USD → LKR conversion used everywhere
// Twilio cost is displayed. Auto-refreshes daily from a free public feed
// (open.er-api.com — no API key required). Admin can also pin a manual
// rate that overrides the auto-fetch until they switch back. Env var
// USD_TO_LKR provides a hardcoded last-resort fallback.
export const FX_SETTING_KEY = "usd_to_lkr";
export const FX_SOURCE_KEY = "usd_to_lkr_source"; // "auto" | "manual"
export const FX_UPDATED_KEY = "usd_to_lkr_updated_at"; // ISO timestamp
export const FX_DEFAULT = Number(process.env.USD_TO_LKR) > 0
  ? Number(process.env.USD_TO_LKR)
  : 320;
const FX_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h
const FX_FETCH_TIMEOUT_MS = 2500;

async function fetchLiveUsdToLkr(): Promise<number | null> {
  // open.er-api.com is free, no API key, daily ECB-derived rates with
  // LKR coverage. We give it a short timeout — never block a page render
  // on this external dependency.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FX_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success") return null;
    const lkr = data.rates?.LKR;
    return typeof lkr === "number" && lkr > 0 ? lkr : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type FxSnapshot = {
  rate: number;
  source: "auto" | "manual" | "fallback";
  updatedAt: string | null;
};

export async function getUsdToLkrSnapshot(): Promise<FxSnapshot> {
  try {
    const [rawRate, rawSource, rawUpdated] = await Promise.all([
      getSetting(FX_SETTING_KEY),
      getSetting(FX_SOURCE_KEY),
      getSetting(FX_UPDATED_KEY),
    ]);
    const stored = Number(rawRate);
    const source: "auto" | "manual" = rawSource === "manual" ? "manual" : "auto";
    const updatedAt = rawUpdated || null;
    const ageMs = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Infinity;
    const isFresh = Number.isFinite(ageMs) && ageMs < FX_REFRESH_MS;

    // Manual override: trust whatever the admin pinned.
    if (source === "manual" && Number.isFinite(stored) && stored > 0) {
      return { rate: stored, source, updatedAt };
    }
    // Auto mode + fresh cached value: return it.
    if (source === "auto" && Number.isFinite(stored) && stored > 0 && isFresh) {
      return { rate: stored, source, updatedAt };
    }
    // Auto mode + stale (or no cache): try a live fetch.
    const live = await fetchLiveUsdToLkr();
    if (live) {
      const nowIso = new Date().toISOString();
      try {
        await Promise.all([
          setSetting(FX_SETTING_KEY, String(live)),
          setSetting(FX_SOURCE_KEY, "auto"),
          setSetting(FX_UPDATED_KEY, nowIso),
        ]);
      } catch { /* best-effort cache write */ }
      return { rate: live, source: "auto", updatedAt: nowIso };
    }
    // Live fetch failed — return the most recent we have, else the fallback.
    if (Number.isFinite(stored) && stored > 0) {
      return { rate: stored, source: "auto", updatedAt };
    }
    return { rate: FX_DEFAULT, source: "fallback", updatedAt: null };
  } catch {
    return { rate: FX_DEFAULT, source: "fallback", updatedAt: null };
  }
}

export async function getUsdToLkr(): Promise<number> {
  const snap = await getUsdToLkrSnapshot();
  return snap.rate;
}

// Rate: Rs. 3 per billable minute. Each call is rounded up to the next whole
// minute. Change once and both admin + client portal pick it up.
const RATE_PER_MINUTE = 3;
const CURRENCY = "Rs.";

// Default package inclusion when an agent has no explicit quota config:
// 40 hours of voice calls per calendar month, warn at 80%. Per-agent
// overrides live on the sentinel_agent row (quota_start_date,
// quota_reset_cadence, quota_included_minutes) and are editable from the
// admin SPA's Quota config panel.
export const INCLUDED_MINUTES_PER_MONTH = 40 * 60;
export const QUOTA_WARN_MINUTES = Math.max(1, Math.floor(INCLUDED_MINUTES_PER_MONTH * 0.8));

export function billingRate() {
  return { perMinute: RATE_PER_MINUTE, currency: CURRENCY };
}

export type BillingRange = "total" | "today" | "week" | "month" | "custom";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export type BillingLineItem = {
  id: string;
  caller: string;
  direction: string;
  startedAt: string;
  startedAtIso: string;
  duration: string;
  durationSec: number;
  billableMinutes: number;
  cost: number;
  outcome: string;
};

export type BillingSnapshot = {
  configured: boolean;
  hasSub?: boolean;
  error?: string | null;
  subaccount?: string;
  range: BillingRange;
  start: string | null;
  end: string | null;
  rate: { perMinute: number; currency: string };
  kpis: {
    calls: number;
    billableCalls: number;
    durationSec: number;
    billableMinutes: number;
    totalCost: number;
    avgCallCost: number;
  };
  seriesLabel: string;
  series: { label: string; value: number }[];
  lineItems: BillingLineItem[];
};

function emptySnapshot(range: BillingRange): BillingSnapshot {
  return {
    configured: false,
    range,
    start: null,
    end: null,
    rate: billingRate(),
    kpis: { calls: 0, billableCalls: 0, durationSec: 0, billableMinutes: 0, totalCost: 0, avgCallCost: 0 },
    seriesLabel: `Cost by day (${CURRENCY})`,
    series: [],
    lineItems: [],
  };
}

export function computeBillingWindow(range: BillingRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  let customMissing = false;
  if (range === "total") { useDateFilter = false; start.setDate(now.getDate() - 29); }
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    if (customStart && customEnd) {
      start = new Date(customStart + "T00:00:00Z");
      endDate = new Date(customEnd + "T00:00:00Z");
    } else { customMissing = true; start.setDate(now.getDate() - 29); }
  }
  // today: start = today already
  return { start, endDate, useDateFilter, customMissing };
}

export async function getBillingSnapshot(
  agent: DbAgent,
  range: BillingRange,
  opts: { customStart?: string; customEnd?: string } = {}
): Promise<BillingSnapshot> {
  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) {
    return { ...emptySnapshot(range), configured: false, hasSub: !!sub };
  }
  const { start, endDate, useDateFilter, customMissing } = computeBillingWindow(range, opts.customStart, opts.customEnd);
  const endFilter = new Date(endDate.getTime() + 86400000);
  const { calls, error } = await getAllCallsForSubaccount(sub, {
    max: 1000,
    ...(useDateFilter && !customMissing ? { startDate: ymd(start), endDate: ymd(endFilter) } : {}),
  });

  const lineItems: BillingLineItem[] = calls.map((c) => {
    const bm = c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0;
    return {
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      startedAtIso: c.startedAtIso,
      duration: c.duration,
      durationSec: c.durationSec,
      billableMinutes: bm,
      cost: bm * RATE_PER_MINUTE,
      outcome: c.outcome,
    };
  });

  const totalSec = calls.reduce((s, c) => s + c.durationSec, 0);
  const totalMin = lineItems.reduce((s, l) => s + l.billableMinutes, 0);
  const totalCost = totalMin * RATE_PER_MINUTE;
  const billableCalls = lineItems.filter((l) => l.billableMinutes > 0).length;
  const avgCallCost = billableCalls ? totalCost / billableCalls : 0;

  let series: { label: string; value: number }[];
  let seriesLabel: string;
  if (range === "today") {
    const map = new Map<number, number>();
    for (const li of lineItems) {
      if (!li.startedAtIso) continue;
      const d = new Date(li.startedAtIso);
      if (isNaN(d.getTime())) continue;
      const h = d.getHours();
      map.set(h, (map.get(h) ?? 0) + li.cost);
    }
    const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    series = hours.map((h) => ({
      label: h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`,
      value: (map.get(h) ?? 0) + (map.get(h - 1) ?? 0),
    }));
    seriesLabel = `Cost by hour (${CURRENCY})`;
  } else {
    const map = new Map<string, number>();
    for (const li of lineItems) {
      if (!li.startedAtIso) continue;
      const d = new Date(li.startedAtIso);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + li.cost);
    }
    const dayMs = 86400000;
    const s0 = new Date(start); s0.setHours(0, 0, 0, 0);
    const out: { label: string; value: number }[] = [];
    for (let t = s0.getTime(); t <= endDate.getTime() && out.length < 120; t += dayMs) {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: map.get(key) ?? 0 });
    }
    series = out;
    seriesLabel = range === "total" ? `Cost by day (${CURRENCY}, last 30 days)` : `Cost by day (${CURRENCY})`;
  }

  return {
    configured: true,
    error: error || null,
    subaccount: sub,
    range,
    start: range === "total" ? null : ymd(start),
    end: range === "total" ? null : ymd(endDate),
    rate: billingRate(),
    kpis: {
      calls: calls.length,
      billableCalls,
      durationSec: totalSec,
      billableMinutes: totalMin,
      totalCost,
      avgCallCost: Math.round(avgCallCost * 100) / 100,
    },
    seriesLabel,
    series,
    lineItems: lineItems.slice(0, 500),
  };
}

export function moneyLKR(n: number) {
  return `Rs. ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type QuotaStatus = "ok" | "warn" | "exceeded";

export type AgentQuotaSnapshot = {
  configured: boolean;
  error?: string | null;
  periodYm: string; // e.g. "2026-06" (monthly) | "2026-W23" (weekly) | "since-2026-05-15" (none)
  periodLabel: string; // e.g. "June 2026" | "Week of 2026-06-08" | "Since 2026-05-15"
  periodStart: string; // ISO 'YYYY-MM-DD' — first day of the active billing period
  periodEnd: string;   // ISO 'YYYY-MM-DD' — first day OUTSIDE the active period (exclusive)
  cadence: "monthly" | "weekly" | "none";
  billableMinutes: number;
  includedMinutes: number;
  warnMinutes: number;
  percent: number;
  status: QuotaStatus;
  overageMinutes: number;
  overageCost: number;
};

function periodLabelFromYm(y: number, m1to12: number) {
  return new Date(Date.UTC(y, m1to12 - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Compute the current billing period from the agent's seed start_date + cadence.
// Monthly: period rolls on the seed's day-of-month (1st by default). Weekly:
// 7-day windows from the seed. None: one open-ended period from the seed.
function computePeriodWindow(
  seed: string,
  cadence: "monthly" | "weekly" | "none",
  now = new Date(),
): { start: Date; end: Date; periodYm: string; periodLabel: string } {
  // Parse seed as UTC midnight to avoid tz drift.
  const [sy, sm, sd] = seed.split("-").map((n) => Number(n));
  const seedDate = new Date(Date.UTC(sy, (sm || 1) - 1, sd || 1));
  if (cadence === "none") {
    const start = seedDate;
    const end = new Date(Date.UTC(9999, 0, 1));
    return {
      start,
      end,
      periodYm: `since-${seed}`,
      periodLabel: `Since ${seed}`,
    };
  }
  if (cadence === "weekly") {
    const oneDay = 86400000;
    const daysSince = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - seedDate.getTime()) / oneDay);
    const weeks = Math.max(0, Math.floor(daysSince / 7));
    const start = new Date(seedDate.getTime() + weeks * 7 * oneDay);
    const end = new Date(start.getTime() + 7 * oneDay);
    // ISO week label like "2026-W23"
    const isoYear = start.getUTCFullYear();
    const oneJan = new Date(Date.UTC(isoYear, 0, 1));
    const week = Math.ceil(((start.getTime() - oneJan.getTime()) / oneDay + oneJan.getUTCDay() + 1) / 7);
    return {
      start,
      end,
      periodYm: `${isoYear}-W${String(week).padStart(2, "0")}`,
      periodLabel: `Week of ${start.toISOString().slice(0, 10)}`,
    };
  }
  // monthly (default): period starts on the seed's day-of-month each month.
  const seedDay = seedDate.getUTCDate();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth(); // 0-based
  const today = now.getUTCDate();
  let py = nowY, pm = nowM;
  if (today < seedDay) {
    // Roll back to previous month.
    if (pm === 0) { pm = 11; py -= 1; } else pm -= 1;
  }
  // Cap day to last day of month if seedDay > last day (e.g. seed=31 in Feb).
  const lastDayOfStart = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
  const startDay = Math.min(seedDay, lastDayOfStart);
  const start = new Date(Date.UTC(py, pm, startDay));
  let ey = py, em = pm + 1;
  if (em > 11) { em = 0; ey += 1; }
  const lastDayOfEnd = new Date(Date.UTC(ey, em + 1, 0)).getUTCDate();
  const endDay = Math.min(seedDay, lastDayOfEnd);
  const end = new Date(Date.UTC(ey, em, endDay));
  return {
    start,
    end,
    periodYm: `${py}-${String(pm + 1).padStart(2, "0")}`,
    periodLabel: periodLabelFromYm(py, pm + 1),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pickCadence(raw: string | null | undefined): "monthly" | "weekly" | "none" {
  if (raw === "weekly" || raw === "none") return raw;
  return "monthly";
}

function normalizeSeedDate(raw: unknown): string | null {
  if (!raw) return null;
  // The neon driver returns DATE columns as YYYY-MM-DD strings, but in some
  // builds it returns a Date object — handle both. Anything else (e.g. an
  // ISO timestamp from a JSON round-trip) just slices to the date portion.
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  return null;
}

export async function getAgentMonthlyQuota(agent: DbAgent): Promise<AgentQuotaSnapshot> {
  const cadence = pickCadence(agent.quota_reset_cadence);
  const includedMinutes = agent.quota_included_minutes && agent.quota_included_minutes > 0
    ? agent.quota_included_minutes
    : INCLUDED_MINUTES_PER_MONTH;
  const warnMinutes = Math.max(1, Math.floor(includedMinutes * 0.8));
  // Seed: prefer the agent's stored start_date. Fallback to 1st of current
  // month so a freshly-created agent (before the migration ran) still gets
  // a sensible monthly rollover instead of a frozen window.
  const now = new Date();
  const normalizedSeed = normalizeSeedDate(agent.quota_start_date);
  const seed = normalizedSeed
    ? normalizedSeed
    : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (!normalizedSeed && agent.quota_start_date) {
    console.warn("[quota] could not parse quota_start_date, using month-start fallback", {
      agent: agent.id, raw: agent.quota_start_date,
    });
  }
  const win = computePeriodWindow(seed, cadence, now);
  const base: AgentQuotaSnapshot = {
    configured: false,
    periodYm: win.periodYm,
    periodLabel: win.periodLabel,
    periodStart: isoDate(win.start),
    periodEnd: isoDate(win.end),
    cadence,
    billableMinutes: 0,
    includedMinutes,
    warnMinutes,
    percent: 0,
    status: "ok",
    overageMinutes: 0,
    overageCost: 0,
  };
  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) return base;

  const { calls, error } = await getAllCallsForSubaccount(sub, {
    max: 1000,
    startDate: isoDate(win.start),
    endDate: isoDate(win.end),
  });
  if (error) return { ...base, configured: true, error };

  const billableMinutes = calls.reduce((s, c) => s + (c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0), 0);
  const overageMinutes = Math.max(0, billableMinutes - includedMinutes);
  const status: QuotaStatus = billableMinutes >= includedMinutes
    ? "exceeded"
    : billableMinutes >= warnMinutes
      ? "warn"
      : "ok";
  // Debug breadcrumb in Vercel function logs.
  if (billableMinutes > 0 || status !== "ok") {
    console.log("[quota]", {
      agent: agent.id,
      cadence,
      periodYm: win.periodYm,
      periodStart: base.periodStart,
      periodEnd: base.periodEnd,
      callsCount: calls.length,
      billableMinutes,
      includedMinutes,
      warnMinutes,
      status,
    });
  }
  return {
    ...base,
    configured: true,
    error: null,
    billableMinutes,
    percent: Math.min(999, Math.round((billableMinutes / includedMinutes) * 100)),
    status,
    overageMinutes,
    overageCost: overageMinutes * RATE_PER_MINUTE,
  };
}

// Fires once per (agent, calendar month, threshold). Writes an audit row
// with a deterministic id so a refresh storm can't spam the feed. We UPSERT
// on conflict to repair legacy rows that were inserted with target=client_id
// before we switched the schema to target=agent.id — without this, the old
// row blocks the new insert and listAgentNotifications (which filters by
// target=agent.id) returns nothing even though a row exists.
export async function recordQuotaNoticeIfNeeded(agent: DbAgent, snap: AgentQuotaSnapshot): Promise<void> {
  if (!snap.configured || snap.status === "ok") return;
  const sql = getSql();
  if (!sql) return;
  const id = `aud_q_${agent.id}_${snap.periodYm}_${snap.status}`;
  const action = snap.status === "exceeded" ? "client.quota.exceeded" : "client.quota.warn";
  const incl = snap.includedMinutes;
  const usedLabel = `${Math.floor(snap.billableMinutes / 60)}h ${snap.billableMinutes % 60}m`;
  const inclLabel = incl >= 60 && incl % 60 === 0
    ? `${incl / 60}h`
    : `${Math.floor(incl / 60)}h ${incl % 60}m`;
  const cadenceLabel = snap.cadence === "weekly" ? "weekly" : snap.cadence === "none" ? "lifetime" : "monthly";
  const summary = snap.status === "exceeded"
    ? `${agent.name}: ${inclLabel} included calls used for ${snap.periodLabel} — now pay-as-you-go at Rs.${RATE_PER_MINUTE}/min.`
    : `${agent.name}: 80% of ${cadenceLabel} ${inclLabel} call quota used for ${snap.periodLabel} (${usedLabel} of ${inclLabel}).`;
  try {
    await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
              VALUES (${id}, ${"System"}, ${action}, ${"quota"}, ${agent.id}, ${summary})
              ON CONFLICT (id) DO UPDATE
                SET target = EXCLUDED.target,
                    summary = EXCLUDED.summary,
                    action = EXCLUDED.action,
                    admin_name = EXCLUDED.admin_name`;
    console.log("[quota] audit upserted", { id, action, target: agent.id });
  } catch (e) {
    console.warn("[quota] audit upsert failed", { id, err: e instanceof Error ? e.message : String(e) });
    // Audit write is best-effort — never block a page render on it.
  }
}

export function fmtDurSec(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${m}m ${r}s`;
  if (m) return `${m}m ${r}s`;
  return `${r}s`;
}

export type TwilioCostSnapshot = {
  configured: boolean;
  error?: string | null;
  startDate: string | null;
  endDate: string | null;
  fxRate: number;
  fxSource: "auto" | "manual" | "fallback";
  fxUpdatedAt: string | null;
  twilio: {
    // Call-only totals — what's actually comparable to our per-minute invoice.
    totalUsd: number;
    totalLkr: number;
    categories: UsageCategory[];
    // Twilio cost we're NOT invoicing for (Conversation Relay, Voice Insights,
    // Phone Numbers, recordings, TTS, etc.). Surfaced as context so the admin
    // knows the all-in Twilio bill is bigger than the call-only number.
    nonCallUsd: number;
    nonCallLkr: number;
    nonCallCategories: UsageCategory[];
    allInUsd: number; // call + non-call (matches Twilio Console "Total Price")
  };
  invoiced: { billableMinutes: number; ratePerMinute: number; totalLkr: number };
  marginLkr: number;
  marginPct: number;
};

// Pulls Twilio's actual aggregate cost for a subaccount in a given window
// and pairs it with our flat-rate invoice (Rs.3/min × billable minutes
// summed via per-call ceiling). Used by the admin Billing tab "Twilio
// cost vs. invoiced" panel.
export async function getTwilioCostForAgent(
  agent: DbAgent,
  opts: { startDate?: string; endDate?: string } = {},
): Promise<TwilioCostSnapshot> {
  const sub = agent.twilio_subaccount_sid || "";
  const fxSnap = await getUsdToLkrSnapshot();
  const fx = fxSnap.rate;
  const empty: TwilioCostSnapshot = {
    configured: false,
    startDate: opts.startDate || null,
    endDate: opts.endDate || null,
    fxRate: fx,
    fxSource: fxSnap.source,
    fxUpdatedAt: fxSnap.updatedAt,
    twilio: { totalUsd: 0, totalLkr: 0, categories: [], nonCallUsd: 0, nonCallLkr: 0, nonCallCategories: [], allInUsd: 0 },
    invoiced: { billableMinutes: 0, ratePerMinute: RATE_PER_MINUTE, totalLkr: 0 },
    marginLkr: 0,
    marginPct: 0,
  };
  if (!isTwilioAuthConfigured() || !sub) return empty;

  const [usage, callsRes] = await Promise.all([
    getUsageRecordsForSubaccount(sub, opts),
    getAllCallsForSubaccount(sub, {
      max: 1000,
      ...(opts.startDate ? { startDate: opts.startDate } : {}),
      ...(opts.endDate ? { endDate: opts.endDate } : {}),
    }),
  ]);
  if (usage.error) {
    return { ...empty, configured: true, error: usage.error };
  }
  const billableMinutes = callsRes.calls.reduce(
    (s, c) => s + (c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0),
    0,
  );
  const invoicedLkr = billableMinutes * RATE_PER_MINUTE;

  // Split Twilio's categories into:
  //   • CALL categories (calls-inbound*, calls-outbound*, calls-client*) —
  //     these map to the per-minute traffic we invoice for
  //   • NON-CALL categories (Conversation Relay, Voice Insights, Phone
  //     Number rentals, recordings, TTS, etc.) — Twilio add-ons NOT
  //     invoiced under the flat Rs.3/min rate
  // Dedup parent + child within the call set: when a direction rollup
  // (calls-inbound / calls-outbound) is present alongside any of its
  // leaf children, drop the rollup so we don't double-count.
  const callRaw = usage.categories.filter((c) => isCallBillingCategory(c.category));
  const nonCallCategories = usage.categories.filter((c) => !isCallBillingCategory(c.category));
  const hasInboundLeaf = callRaw.some((c) => c.category.startsWith("calls-inbound-"));
  const hasOutboundLeaf = callRaw.some((c) => c.category.startsWith("calls-outbound-"));
  const hasClientLeaf = callRaw.some((c) => c.category.startsWith("calls-client-"));
  const callCategories = callRaw.filter((c) => {
    if (c.category === "calls-inbound" && hasInboundLeaf) return false;
    if (c.category === "calls-outbound" && hasOutboundLeaf) return false;
    if (c.category === "calls-client" && hasClientLeaf) return false;
    return true;
  }).sort((a, b) => b.priceUsd - a.priceUsd);

  const callTotalUsd = callCategories.reduce((s, c) => s + c.priceUsd, 0);
  const nonCallUsd = nonCallCategories
    .filter((c) => !isCallDirectionRollup(c.category)) // safety; non-call set already excludes calls-* but keep defensive
    .reduce((s, c) => s + c.priceUsd, 0);
  const allInUsd = callTotalUsd + nonCallUsd;

  const twilioLkr = Math.round(callTotalUsd * fx * 100) / 100;
  const nonCallLkr = Math.round(nonCallUsd * fx * 100) / 100;
  const marginLkr = Math.round((invoicedLkr - twilioLkr) * 100) / 100;
  const marginPct = invoicedLkr > 0
    ? Math.round((marginLkr / invoicedLkr) * 1000) / 10
    : 0;
  return {
    configured: true,
    error: null,
    startDate: opts.startDate || null,
    endDate: opts.endDate || null,
    fxRate: fx,
    fxSource: fxSnap.source,
    fxUpdatedAt: fxSnap.updatedAt,
    twilio: {
      totalUsd: callTotalUsd,
      totalLkr: twilioLkr,
      categories: callCategories,
      nonCallUsd,
      nonCallLkr,
      nonCallCategories,
      allInUsd,
    },
    invoiced: { billableMinutes, ratePerMinute: RATE_PER_MINUTE, totalLkr: invoicedLkr },
    marginLkr,
    marginPct,
  };
}
