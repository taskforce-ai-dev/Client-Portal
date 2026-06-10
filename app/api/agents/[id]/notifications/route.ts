import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentForClient, getSql, isDbConfigured } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Delete a single stored notification by id, scoped to the calling client's
// agents. Bulk-delete is intentionally NOT exposed here — only admins
// should be able to wipe the audit history.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getClientSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentForClient(params.id, session.clientId);
  if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

  const url = new URL(req.url);
  const oneId = url.searchParams.get("id");
  if (!oneId) return NextResponse.json({ message: "id query param is required" }, { status: 400 });
  if (!oneId.startsWith(`aud_q_${agent.id}_`)) {
    return NextResponse.json({ message: "id does not belong to this agent" }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) return NextResponse.json({ message: "Database not configured" }, { status: 503 });
  try {
    const rows = (await sql`DELETE FROM sentinel_audit WHERE id = ${oneId} RETURNING id`) as { id: string }[];
    return NextResponse.json({ ok: true, deleted: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
