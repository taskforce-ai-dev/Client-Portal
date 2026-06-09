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

// Wipe every stored quota notification for this agent so the admin can
// re-test the threshold from a clean slate. Idempotent — running it
// twice just returns 0 the second time.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ message: "Database not configured" }, { status: 503 });
  try {
    const rows = (await sql`DELETE FROM sentinel_audit
                            WHERE target = ${agent.id}
                              AND action LIKE 'client.quota.%'
                            RETURNING id`) as { id: string }[];
    return NextResponse.json({ ok: true, deleted: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
