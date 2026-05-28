import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No hardcoded data — metrics are zero until a datastore is connected.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    clients: { total: 0, active: 0, trial: 0, suspended: 0 },
    revenue: { monthlyRecurring: 0 },
    agents: { live: 0, total: 0, paused: 0, idle: 0 },
    support: { openTickets: 0 },
    plans: [],
  });
}
