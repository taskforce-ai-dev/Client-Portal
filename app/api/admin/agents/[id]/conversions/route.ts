import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, listCallSummaries } from "@/lib/adminDb";
import { computeStats, toConversion, type Conversion } from "@/lib/conversion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// Mirror of the client portal's Conversions page, exposed for the admin
// SPA. Runs the same toConversion pipeline against the same
// sentinel_call_summary rows, so the admin and client see identical
// classifications, prices, references, dates, etc.
//
// Query: ?range=total|today|week|month|custom (&start=YYYY-MM-DD&end=YYYY-MM-DD)
//        &status=confirmed|inquiry|no_booking|all (default: confirmed)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  let range = sp.get("range") || "total";
  if (!["total", "today", "week", "month", "custom"].includes(range)) range = "total";
  const statusFilter = sp.get("status") || "confirmed";

  const now = new Date();
  let start = new Date(now); start.setHours(0, 0, 0, 0);
  let end = now;
  let useFilter = true;
  let customMissing = false;
  if (range === "total") useFilter = false;
  else if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "custom") {
    const cs = sp.get("start"); const ce = sp.get("end");
    if (cs && ce) {
      start = new Date(cs + "T00:00:00Z");
      end = new Date(ce + "T23:59:59Z");
    } else customMissing = true;
  }

  const rows = useFilter
    ? await listCallSummaries(agent.id, {
        limit: 1000,
        startIso: start.toISOString(),
        endIso: new Date(end.getTime() + 86400000).toISOString(),
      })
    : await listCallSummaries(agent.id, { limit: 1000 });

  const all: Conversion[] = rows.map(toConversion);
  // Sort newest first — matches the client portal.
  all.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const stats = computeStats(all);
  const filtered = statusFilter === "all" ? all : all.filter((c) => c.status === statusFilter);

  const statusCounts: Record<string, number> = { all: all.length };
  for (const c of all) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    range,
    start: useFilter && !customMissing ? ymd(start) : null,
    end: useFilter && !customMissing ? ymd(end) : null,
    customMissing,
    stats,
    statusCounts,
    items: filtered,
  });
}
