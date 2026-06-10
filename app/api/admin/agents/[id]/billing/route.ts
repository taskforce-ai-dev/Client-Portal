import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, isDbConfigured } from "@/lib/adminDb";
import { getAllCallsForSubaccount, isTwilioAuthConfigured } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_PER_MINUTE = 3; // Rs. per billable minute (per-call rounded up)
const CURRENCY = "Rs.";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Per-agent billing snapshot for the selected range.
// Query: ?range=total|today|week|month|custom (&start=YYYY-MM-DD&end=YYYY-MM-DD)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const client = await findClientById(agent.client_id);

  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) {
    return NextResponse.json({
      configured: false,
      hasSub: !!sub,
      rate: { perMinute: RATE_PER_MINUTE, currency: CURRENCY },
      agent: { id: agent.id, name: agent.name },
      client: client ? { id: client.id, company: client.company, email: client.email } : null,
    });
  }

  const sp = req.nextUrl.searchParams;
  let range = sp.get("range") || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";

  const now = new Date();
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let endDate = now;
  let useDateFilter = true;
  let customMissing = false;
  if (range === "total") {
    useDateFilter = false;
    start.setDate(now.getDate() - 29); // chart window only
  } else if (range === "today") {
    // start = today already
  } else if (range === "week") {
    start.setDate(now.getDate() - 6);
  } else if (range === "month") {
    start.setDate(now.getDate() - 29);
  } else if (range === "custom") {
    if (sp.get("start") && sp.get("end")) {
      start = new Date(sp.get("start") + "T00:00:00Z");
      endDate = new Date(sp.get("end") + "T00:00:00Z");
    } else {
      customMissing = true;
      start.setDate(now.getDate() - 29);
    }
  }
  const endFilter = new Date(endDate.getTime() + 86400000);

  const { calls, error } = await getAllCallsForSubaccount(sub, {
    max: 1000,
    ...(useDateFilter && !customMissing
      ? { startDate: ymd(start), endDate: ymd(endFilter) }
      : {}),
  });

  // Per-call billing: round each call's duration up to the next whole
  // minute. Also surfaces Twilio's own per-call USD price so the admin
  // Billing tab can show margin per row (price is null for very fresh
  // calls — Twilio's billing pipeline lags by a few minutes).
  const lineItems = calls.map((c) => {
    const billableMin = c.durationSec > 0 ? Math.ceil(c.durationSec / 60) : 0;
    return {
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      startedAtIso: c.startedAtIso,
      duration: c.duration,
      durationSec: c.durationSec,
      billableMinutes: billableMin,
      cost: billableMin * RATE_PER_MINUTE,
      outcome: c.outcome,
      twilioPriceUsd: c.twilioPriceUsd,
      twilioPriceUnit: c.twilioPriceUnit ?? null,
    };
  });

  const totalSec = calls.reduce((s, c) => s + c.durationSec, 0);
  const totalBillableMin = lineItems.reduce((s, li) => s + li.billableMinutes, 0);
  const totalCost = totalBillableMin * RATE_PER_MINUTE;
  const billableCalls = lineItems.filter((li) => li.billableMinutes > 0).length;
  const avgCallCost = billableCalls ? totalCost / billableCalls : 0;

  // Cost-by-day (or by-hour for today)
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
    const s0 = new Date(start);
    s0.setHours(0, 0, 0, 0);
    const out: { label: string; value: number }[] = [];
    for (let t = s0.getTime(); t <= endDate.getTime() && out.length < 120; t += dayMs) {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: map.get(key) ?? 0 });
    }
    series = out;
    seriesLabel = range === "total"
      ? `Cost by day (${CURRENCY}, last 30 days)`
      : `Cost by day (${CURRENCY})`;
  }

  return NextResponse.json({
    configured: true,
    error: error || null,
    subaccount: sub,
    range,
    start: range === "total" ? null : ymd(start),
    end: range === "total" ? null : ymd(endDate),
    rate: { perMinute: RATE_PER_MINUTE, currency: CURRENCY },
    agent: { id: agent.id, name: agent.name, role: agent.role, type: agent.type, channels: agent.channels },
    client: client ? { id: client.id, company: client.company, email: client.email } : null,
    kpis: {
      calls: calls.length,
      billableCalls,
      durationSec: totalSec,
      billableMinutes: totalBillableMin,
      totalCost,
      avgCallCost: Math.round(avgCallCost * 100) / 100,
    },
    seriesLabel,
    series,
    lineItems: lineItems.slice(0, 500),
  });
}
