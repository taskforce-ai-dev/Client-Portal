import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { createAgent, findClientById, isDbConfigured, listAgentsByClient } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json([]);
  const agents = await listAgentsByClient(params.id);
  return NextResponse.json(
    agents.map((a) => ({ id: a.id, name: a.name, role: a.role, type: a.type, status: a.status, channels: a.channels, description: a.description }))
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const client = await findClientById(params.id);
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });
  let body: { name?: string; type?: string; role?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ message: "Agent name is required" }, { status: 400 });
  }
  const agent = await createAgent({
    clientId: client.id,
    name: body.name,
    type: body.type,
    role: body.role,
    description: body.description,
  });
  return NextResponse.json({ ok: true, agent: { id: agent.id, name: agent.name } });
}
