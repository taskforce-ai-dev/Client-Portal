import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findClientById, isDbConfigured, listAgentsByClient } from "@/lib/adminDb";
import {
  bucketCallsByDayRange,
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
  getAllCallsForSubaccount,
  isTwilioAuthConfigured,
} from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Aggregated Twilio snapshot across ALL of a client's agents (each agent has
// its own subaccount). Default range is "total" — all-time across the
// client's subaccounts. KPIs/series/outcomes reflect the selected range.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false });
  const client = await findClientById(params.id);
  if (!client) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const agents = await listAgentsByClient(client.id);
  const linked = agents.filter((a) => a.twilio_subaccount_sid);
  if (!isTwilioAuthConfigured() || linked.length === 0) {
    return NextResponse.json({
      configured: false,
      agentsTotal: agents.length,
      agentsLinked: 0,
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
    start.setDate(now.getDate() - 29); // for the chart window only
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

  // Fetch each agent's calls in parallel (single-page paginated, capped).
  const perAgent = await Promise.all(
    linked.map(async (a) => {
      const res = await getAllCallsForSubaccount(a.twilio_subaccount_sid!, {
        max: 1000,
        ...(useDateFilter && !customMissing
          ? { startDate: ymd(start), endDate: ymd(endFilter) }
          : range === "custom" && customMissing
          ? { startDate: ymd(start), endDate: ymd(endFilter) } // never reached, but type-safe
          : {}),
      });
      return { agent: a, ...res };
    })
  );

  const allCalls = perAgent
    .flatMap((p) => p.calls.map((c) => ({ ...c, agentId: p.agent.id, agentName: p.agent.name })))
    .sort((a, b) => (a.startedAtIso < b.startedAtIso ? 1 : -1));
  const firstError = perAgent.find((p) => p.error)?.error || null;

  const stats = callStats(allCalls);
  const minutes = Math.round(allCalls.reduce((s, c) => s + c.durationSec, 0) / 60);

  // Chart series window:
  // - today  -> by hour
  // - total  -> by day over the last 30 days (KPIs stay all-time)
  // - else   -> by day across the chosen window
  let series: { label: string; value: number }[];
  let seriesLabel: string;
  if (range === "today") {
    series = bucketCallsByHour(allCalls).map((h) => ({ label: h.hour, value: h.calls }));
    seriesLabel = "Calls by hour";
  } else {
    const chartStart = new Date(now);
    chartStart.setHours(0, 0, 0, 0);
    chartStart.setDate(now.getDate() - (range === "total" ? 29 : 0));
    const realStart = range === "total" ? chartStart : start;
    series = bucketCallsByDayRange(allCalls, realStart.getTime(), endDate.getTime());
    seriesLabel = range === "total" ? "Calls by day (last 30 days)" : "Calls by day";
  }

  return NextResponse.json({
    configured: true,
    error: firstError,
    range,
    start: range === "total" ? null : ymd(start),
    end: range === "total" ? null : ymd(endDate),
    agentsTotal: agents.length,
    agentsLinked: linked.length,
    agents: linked.map((a) => ({ id: a.id, name: a.name })),
    kpis: {
      calls: allCalls.length,
      completed: stats.completed,
      completionRate: stats.completionRate,
      avgDuration: stats.avgDuration,
      minutes,
    },
    seriesLabel,
    series,
    outcomes: bucketOutcomes(allCalls),
  });
}
