import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, findClientById, isDbConfigured } from "@/lib/adminDb";
import { getAgentMonthlyQuota } from "@/lib/billing";
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

  const [{ items, customMissing }, quota, client] = await Promise.all([
    listAgentNotifications(agent.id, range, { customStart: start, customEnd: end }),
    getAgentMonthlyQuota(agent),
    findClientById(agent.client_id),
  ]);

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, client_id: agent.client_id },
    client: client ? { id: client.id, company: client.company } : null,
    quota,
    items,
    customMissing,
    range,
  });
}
