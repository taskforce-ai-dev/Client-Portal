import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured } from "@/lib/adminDb";
import { getTwilioCostForAgent } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Returns Twilio's actual aggregate cost for the subaccount in a window
// and our invoice for the same window — admin-only. The window matches
// the existing /api/admin/agents/[id]/billing range vocabulary so the
// Billing tab can plug it in without recomputing the dates.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  let range = sp.get("range") || "month";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "month";

  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let end = now;
  let useDate = true;
  if (range === "total") useDate = false;
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    const cs = sp.get("start"); const ce = sp.get("end");
    if (cs && ce) { start = new Date(cs + "T00:00:00Z"); end = new Date(ce + "T00:00:00Z"); }
    else useDate = false;
  }

  const snap = await getTwilioCostForAgent(agent, useDate ? { startDate: ymd(start), endDate: ymd(end) } : {});
  return NextResponse.json(snap);
}
