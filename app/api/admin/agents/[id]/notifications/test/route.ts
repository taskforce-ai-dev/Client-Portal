import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, getSql, isDbConfigured } from "@/lib/adminDb";
import { getAgentMonthlyQuota } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fire a synthetic quota notification so the admin can verify the wiring
// without waiting for the 32h / 40h thresholds to be crossed for real.
// The audit row gets a unique id (timestamped) so it stacks on top of any
// real notification rather than colliding with the deterministic monthly
// id used by recordQuotaNoticeIfNeeded.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  let body: { kind?: string } = {};
  try { body = await req.json(); } catch {}
  const kind = body.kind === "exceeded" ? "exceeded" : "warn";

  const sql = getSql();
  if (!sql) return NextResponse.json({ message: "Database not configured" }, { status: 503 });

  const quota = await getAgentMonthlyQuota(agent);
  const id = `aud_q_test_${agent.id}_${Date.now()}`;
  const action = kind === "exceeded" ? "client.quota.exceeded" : "client.quota.warn";
  const summary = kind === "exceeded"
    ? `[Test] ${agent.name}: simulated overage notification for ${quota.periodLabel}. Real quota is ${Math.floor(quota.includedMinutes / 60)}h/month — this is a manual test fire.`
    : `[Test] ${agent.name}: simulated 80% warning for ${quota.periodLabel}. Real quota is ${Math.floor(quota.includedMinutes / 60)}h/month — this is a manual test fire.`;

  try {
    await sql`INSERT INTO sentinel_audit (id, admin_name, action, type, target, summary)
              VALUES (${id}, ${"Admin (test)"}, ${action}, ${"quota"}, ${agent.id}, ${summary})
              ON CONFLICT (id) DO NOTHING`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Insert failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, kind, summary });
}
