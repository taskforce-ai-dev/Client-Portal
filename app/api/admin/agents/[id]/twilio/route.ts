import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured } from "@/lib/adminDb";
import {
  bucketCallsByHour,
  bucketOutcomes,
  callStats,
  callsToday,
  getCallsForSubaccount,
  getUsageForSubaccount,
  isTwilioAuthConfigured,
} from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-agent Twilio snapshot (uses the agent's own subaccount SID).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const sub = agent.twilio_subaccount_sid || "";
  if (!isTwilioAuthConfigured() || !sub) {
    return NextResponse.json({ configured: false, hasSub: !!sub });
  }

  const [{ calls, error }, usage] = await Promise.all([
    getCallsForSubaccount(sub, 50),
    getUsageForSubaccount(sub),
  ]);
  const today = callsToday(calls);
  const stats = callStats(today.length ? today : calls);
  return NextResponse.json({
    configured: true,
    error: error || usage.error || null,
    subaccount: sub,
    kpis: {
      callsToday: today.length,
      callsTotal: calls.length,
      completed: stats.completed,
      completionRate: stats.completionRate,
      avgDuration: stats.avgDuration,
      minutesMonth: Math.round(usage.totalMinutes),
      spendMonth: usage.totalPrice,
    },
    byHour: bucketCallsByHour(today.length ? today : calls),
    outcomes: bucketOutcomes(calls),
    calls: calls.slice(0, 20).map((c) => ({
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      duration: c.duration,
      outcome: c.outcome,
    })),
  });
}
