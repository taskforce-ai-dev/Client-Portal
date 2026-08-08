import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, getAgentKb, isDbConfigured, setAgentKb } from "@/lib/adminDb";
import { requireAgentOwnership } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  // Admins may read any agent's KB; clients only their own, and only while
  // their account is active (requireAgentOwnership enforces both).
  if (isAuthed()) {
    const agent = await findAgentById(params.id);
    if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const content = await getAgentKb(agent.id);
    return NextResponse.json({ content, agent: { id: agent.id, name: agent.name } });
  }
  const guard = await requireAgentOwnership(params.id);
  if (guard.error) return guard.error;
  const content = await getAgentKb(guard.agent.id);
  return NextResponse.json({ content, agent: { id: guard.agent.id, name: guard.agent.name } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  if (!isAuthed()) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const content = body.content ?? "";
  await setAgentKb(agent.id, agent.client_id, content);
  void fireKbReload(agent, content);
  return NextResponse.json({ ok: true });
}
