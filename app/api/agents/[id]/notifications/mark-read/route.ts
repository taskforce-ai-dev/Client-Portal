import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records a "last-read at" cookie so the sidebar Bell badge and topbar
// dot only count notifications that arrived AFTER this client opened the
// Notifications tab. Cookie name is agent-scoped so multiple agents on
// the same client account each get an independent unread cursor.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const now = new Date().toISOString();
  cookies().set(`notif_read_${agent.id}`, now, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // keep for a year — overwritten on every visit
  });
  return NextResponse.json({ ok: true, since: now });
}
