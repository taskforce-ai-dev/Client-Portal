import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { callStats, callsToday, getCalls, getUsageThisMonth, isTwilioConfigured } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only Twilio snapshot: connection status, KPIs, recent call logs.
// Currently workspace-wide (single subaccount) — not yet per-agent.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isTwilioConfigured()) {
    return NextResponse.json({ configured: false });
  }
  const [{ calls, error }, usage] = await Promise.all([getCalls(25), getUsageThisMonth()]);
  const today = callsToday(calls);
  const stats = callStats(today);
  return NextResponse.json({
    configured: true,
    error: error || usage.error || null,
    kpis: {
      callsToday: today.length,
      callsTotal: calls.length,
      convRate: stats.convRate,
      booked: stats.booked,
      avgDuration: stats.avgDuration,
      minutesMonth: Math.round(usage.totalMinutes),
      spendMonth: usage.totalPrice,
    },
    calls: calls.slice(0, 15).map((c) => ({
      id: c.id,
      caller: c.caller,
      direction: c.direction,
      startedAt: c.startedAt,
      duration: c.duration,
      outcome: c.outcome,
    })),
  });
}
