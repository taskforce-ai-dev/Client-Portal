import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, getSql, isDbConfigured } from "@/lib/adminDb";
import { getAgentMonthlyQuota, recordQuotaNoticeIfNeeded } from "@/lib/billing";
import { listAgentNotifications, type NotificationsRange } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_RANGES: NotificationsRange[] = ["total", "today", "week", "month", "custom"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const url = new URL(req.url);
  const rangeIn = url.searchParams.get("range") as NotificationsRange | null;
  const range: NotificationsRange = rangeIn && VALID_RANGES.includes(rangeIn) ? rangeIn : "total";
  const start = url.searchParams.get("start") || undefined;
  const end = url.searchParams.get("end") || undefined;

  const [quota, client] = await Promise.all([
    getAgentMonthlyQuota(agent),
    findClientById(agent.client_id),
  ]);
  // Fire-and-store the threshold notification on every admin load so the
  // audit row gets written even if the client never opens their portal.
  // recordQuotaNoticeIfNeeded is idempotent — deterministic id keeps it
  // to one row per (agent, month, threshold).
  await recordQuotaNoticeIfNeeded(agent, quota);
  const { items, customMissing } = await listAgentNotifications(agent.id, range, { customStart: start, customEnd: end });

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, client_id: agent.client_id },
    client: client ? { id: client.id, company: client.company } : null,
    quota,
    items,
    customMissing,
    range,
  });
}

// Delete stored quota notifications for this agent.
//   ?id=<auditRowId> deletes one row (selective clear)
//   no id            deletes every quota row for the agent (bulk clear)
// Bulk-clear sweeps by id pattern, NOT by target, so legacy rows that were
// inserted with target=client_id (before the schema change) also get
// wiped — their ids still follow the aud_q_{agent.id}_... shape.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ message: "Database not configured" }, { status: 503 });

  const url = new URL(req.url);
  const oneId = url.searchParams.get("id");
  const idPattern = `aud_q_${agent.id}_%`;
  try {
    if (oneId) {
      // Guard against deleting an unrelated audit row by ensuring the id
      // belongs to THIS agent's quota namespace.
      if (!oneId.startsWith(`aud_q_${agent.id}_`)) {
        return NextResponse.json({ message: "id does not belong to this agent" }, { status: 400 });
      }
      const rows = (await sql`DELETE FROM sentinel_audit WHERE id = ${oneId} RETURNING id`) as { id: string }[];
      return NextResponse.json({ ok: true, deleted: rows.length });
    }
    const rows = (await sql`DELETE FROM sentinel_audit
                            WHERE id LIKE ${idPattern}
                            RETURNING id`) as { id: string }[];
    return NextResponse.json({ ok: true, deleted: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
