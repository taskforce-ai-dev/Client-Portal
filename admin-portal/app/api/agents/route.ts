import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAgent } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    clientId?: string;
    name?: string;
    role?: string;
    channel?: string;
    status?: string;
    salespersonId?: string | null;
    commissionPercent?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.clientId || !body.name) {
    return NextResponse.json({ error: "clientId and name are required" }, { status: 400 });
  }
  const agent = await createAgent({
    clientId: body.clientId,
    name: body.name,
    role: body.role || "Agent",
    channel: (body.channel as "voice" | "whatsapp") ?? "voice",
    status: (body.status as "live" | "paused" | "draft") ?? "draft",
    salespersonId: body.salespersonId ?? null,
    commissionPercent: Number(body.commissionPercent) || 0,
  });
  return NextResponse.json({ agent });
}
