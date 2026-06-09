import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, updateAgentQuotaConfig } from "@/lib/adminDb";
import { getAgentMonthlyQuota, recordQuotaNoticeIfNeeded } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CADENCE = new Set(["monthly", "weekly", "none"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
  const quota = await getAgentMonthlyQuota(agent);
  return NextResponse.json({
    config: {
      start_date: agent.quota_start_date,
      reset_cadence: agent.quota_reset_cadence,
      included_minutes: agent.quota_included_minutes,
    },
    quota,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { start_date?: string; reset_cadence?: string; included_minutes?: number; included_hours?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ message: "Invalid request body" }, { status: 400 }); }

  if (body.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
    return NextResponse.json({ message: "start_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (body.reset_cadence && !VALID_CADENCE.has(body.reset_cadence)) {
    return NextResponse.json({ message: "reset_cadence must be monthly | weekly | none" }, { status: 400 });
  }
  // Accept either minutes or hours; hours wins if both sent.
  const minutes = typeof body.included_hours === "number"
    ? Math.round(body.included_hours * 60)
    : (typeof body.included_minutes === "number" ? Math.round(body.included_minutes) : undefined);
  if (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0)) {
    return NextResponse.json({ message: "included_minutes / included_hours must be positive" }, { status: 400 });
  }

  const updated = await updateAgentQuotaConfig(params.id, {
    start_date: body.start_date,
    reset_cadence: body.reset_cadence,
    included_minutes: minutes,
  });
  if (!updated) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  // Re-evaluate the threshold immediately with the new config so the audit
  // row reflects the new quota right away (e.g. shrinking included_minutes
  // may push the agent across exceeded on the spot).
  const quota = await getAgentMonthlyQuota(updated);
  try { await recordQuotaNoticeIfNeeded(updated, quota); } catch {}

  return NextResponse.json({
    ok: true,
    config: {
      start_date: updated.quota_start_date,
      reset_cadence: updated.quota_reset_cadence,
      included_minutes: updated.quota_included_minutes,
    },
    quota,
  });
}
