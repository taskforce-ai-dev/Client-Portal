import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateAgent } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.role === "string") patch.role = body.role;
  if (body.channel === "voice" || body.channel === "whatsapp") patch.channel = body.channel;
  if (body.status === "live" || body.status === "paused" || body.status === "draft")
    patch.status = body.status;
  if (body.salespersonId === null || typeof body.salespersonId === "string")
    patch.salespersonId = body.salespersonId;
  if (body.commissionPercent !== undefined)
    patch.commissionPercent = Math.max(0, Math.min(100, Number(body.commissionPercent) || 0));

  const agent = await updateAgent(params.id, patch);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}
