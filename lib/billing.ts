import { DbAgent, getSql } from "./adminDb";
import { getAllCallsForSubaccount, isTwilioAuthConfigured } from "./twilio";

// Rate: Rs. 3 per billable minute. Each call is rounded up to the next whole
// minute. Change once and both admin + client portal pick it up.
const RATE_PER_MINUTE = 3;
const CURRENCY = "Rs.";

// Package inclusion: each agent gets 40 hours of voice calls per calendar
// month. Warn the client at 80% so they aren't surprised.
// TEMPORARY: set to 568 minutes so a 2-minute test call (current usage
// 566 min + 2 = 568) tips the agent into "exceeded" for a fresh popup
// test — REVERT to 40 * 60 (= 2400) before production.
export const INCLUDED_MINUTES_PER_MONTH = 568;
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
  periodYm: string; // e.g. "2026-06"
  periodLabel: string; // e.g. "June 2026"
  billableMinutes: number;
  includedMinutes: number;
  warnMinutes: number;
  percent: number;
  status: QuotaStatus;
  overageMinutes: number;
  overageCost: number;
};

function periodLabelFrom(y: number, m1to12: number) {
  return new Date(Date.UTC(y, m1to12 - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function getAgentMonthlyQuota(agent: DbAgent): Promise<AgentQuotaSnapshot> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const ym = `${y}-${String(m).padStart(2, "0")}`;
  const periodLabel = periodLabelFrom(y, m);
  const base: AgentQuotaSnapshot = {
    configured: false,
    periodYm: ym,
    periodLabel,
    billableMinutes: 0,
    includedMinutes: INCLUDED_MINUTES_PER_MONTH,
    warnMinutes: QUOTA_WARN_MINUTES,
    percent: 0,
    status: "ok",
    overageMinutes: 0,
    overageCost: 0,
  };
  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) return base;

  const start = new Date(y, m - 1, 1);
  const endFilter = new Date(y, m, 1); // exclusive: first day of next month
  const { calls, error } = await getAllCallsForSubaccount(sub, {
    max: 1000,
    startDate: ymd(start),
    endDate: ymd(endFilter),
  });
  if (error) return { ...base, configured: true, error };

  const billableMinutes = calls.reduce((s, c) => s + (c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0), 0);
  const overageMinutes = Math.max(0, billableMinutes - INCLUDED_MINUTES_PER_MONTH);
  const status: QuotaStatus = billableMinutes >= INCLUDED_MINUTES_PER_MONTH
    ? "exceeded"
    : billableMinutes >= QUOTA_WARN_MINUTES
      ? "warn"
      : "ok";
  return {
    ...base,
    configured: true,
    error: null,
    billableMinutes,
    percent: Math.min(999, Math.round((billableMinutes / INCLUDED_MINUTES_PER_MONTH) * 100)),
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
  const summary = snap.status === "exceeded"
    ? `${agent.name}: ${inclLabel} included calls used for ${snap.periodLabel} — now pay-as-you-go at Rs.${RATE_PER_MINUTE}/min.`
    : `${agent.name}: 80% of monthly ${inclLabel} call quota used for ${snap.periodLabel} (${usedLabel} of ${inclLabel}).`;
  try {
    await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
              VALUES (${id}, ${"System"}, ${action}, ${"quota"}, ${agent.id}, ${summary})
              ON CONFLICT (id) DO UPDATE
                SET target = EXCLUDED.target,
                    summary = EXCLUDED.summary,
                    action = EXCLUDED.action,
                    admin_name = EXCLUDED.admin_name`;
  } catch {
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
