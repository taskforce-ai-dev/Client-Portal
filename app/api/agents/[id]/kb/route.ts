import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getClientSession } from "@/lib/clientAuth";
import { findAgentById, getAgentKb, isDbConfigured, setAgentKb } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(agentId: string) {
  const agent = await findAgentById(agentId);
  if (!agent) return null;
  if (isAuthed()) return agent;
  const session = getClientSession();
  if (session && session.clientId === agent.client_id) return agent;
  return null;
}

async function fireKbReload(agent: { id: string; kb_reload_url: string | null }, content: string) {
  const url = agent.kb_reload_url;
  const secret = process.env.KB_RELOAD_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "X-KB-Secret": secret },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[kb-reload] agent", agent.id, "returned", res.status);
  } catch (err) {
    console.error("[kb-reload] failed to reach agent", agent.id, err);
  }
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
  const content = body.content ?? "";
  await setAgentKb(agent.id, agent.client_id, content);
  // Fire-and-forget: push new content to the running agent container.
  void fireKbReload(agent, content);
  return NextResponse.json({ ok: true });
}
