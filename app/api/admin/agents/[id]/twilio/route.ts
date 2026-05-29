import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured } from "@/lib/adminDb";
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

// Per-agent Twilio snapshot for a selected time window.
// Query: ?range=today|week|month|custom (&start=YYYY-MM-DD&end=YYYY-MM-DD)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) {
    return NextResponse.json({ configured: false, hasSub: !!sub });
  }

  const sp = req.nextUrl.searchParams;
  let range = sp.get("range") || "today";
  const now = new Date();
  let start = new Date(now);
  if (range === "custom" && sp.get("start")) {
    start = new Date(sp.get("start") + "T00:00:00Z");
  } else if (range === "week") {
    start.setDate(now.getDate() - 6);
  } else if (range === "month") {
    start.setDate(now.getDate() - 29);
  } else {
    range = "today";
  }
  start.setHours(0, 0, 0, 0);
  const endDate = range === "custom" && sp.get("end") ? new Date(sp.get("end") + "T00:00:00Z") : now;
  // Twilio's StartTime<= is GMT-day based; add a day so the end day is inclusive.
  const endFilter = new Date(endDate.getTime() + 86400000);

  const { calls, error } = await getAllCallsForSubaccount(sub, {
    max: 1000,
    startDate: ymd(start),
    endDate: ymd(endFilter),
  });

  const stats = callStats(calls);
  const minutes = Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / 60);
  const series =
    range === "today"
      ? bucketCallsByHour(calls).map((h) => ({ label: h.hour, value: h.calls }))
      : bucketCallsByDayRange(calls, start.getTime(), endDate.getTime());

  return NextResponse.json({
    configured: true,
    error: error || null,
    subaccount: sub,
    range,
    start: ymd(start),
    end: ymd(endDate),
    kpis: {
      calls: calls.length,
      completed: stats.completed,
      completionRate: stats.completionRate,
      avgDuration: stats.avgDuration,
      minutes,
    },
    seriesLabel: range === "today" ? "Calls by hour" : "Calls by day",
    series,
    outcomes: bucketOutcomes(calls),
    calls: calls.slice(0, 500).map((c) => ({
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      duration: c.duration,
      outcome: c.outcome,
    })),
  });
}
