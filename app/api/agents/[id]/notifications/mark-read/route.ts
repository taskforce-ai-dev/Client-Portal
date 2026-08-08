import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAgentOwnership } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records a "last-read at" cookie so the sidebar Bell badge and topbar
// dot only count notifications that arrived AFTER this client opened the
// Notifications tab. Cookie name is agent-scoped so multiple agents on
// the same client account each get an independent unread cursor.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAgentOwnership(params.id);
  if (guard.error) return guard.error;
  const { agent } = guard;

  const now = new Date().toISOString();
  cookies().set(`notif_read_${agent.id}`, now, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // keep for a year — overwritten on every visit
  });
  return NextResponse.json({ ok: true, since: now });
}
