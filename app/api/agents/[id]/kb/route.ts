import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentById, getAgentKb, isDbConfigured, setAgentKb } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authorize: an admin, or the client that owns the agent. Returns the agent
// row when allowed, or null. Shared by the admin agent-config page and the
// client portal knowledge editor so the KB stays in sync.
async function authorize(agentId: string) {
  const agent = await findAgentById(agentId);
  if (!agent) return null;
  if (isAuthed()) return agent;
  const session = getClientSession();
  if (session && session.clientId === agent.client_id) return agent;
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) return NextResponse.json({ content: "" });
  const agent = await authorize(params.id);
  if (!agent) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const content = await getAgentKb(agent.id);
  return NextResponse.json({ content, agent: { id: agent.id, name: agent.name } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await authorize(params.id);
  if (!agent) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  await setAgentKb(agent.id, agent.client_id, body.content ?? "");
  return NextResponse.json({ ok: true });
}
