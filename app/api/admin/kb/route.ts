import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getAgentKb, isDbConfigured, listAgentsByClient, listClients } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns every agent's knowledge base across every client, so the admin
// "Knowledge Base" tab can edit them all in one place. KB content is shared
// with the client portal via /api/agents/[id]/kb.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ clients: [] });

  const clients = await listClients();
  const out = await Promise.all(
    clients.map(async (c) => {
      const agents = await listAgentsByClient(c.id);
      const enriched = await Promise.all(
        agents.map(async (a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          type: a.type,
          status: a.status,
          content: await getAgentKb(a.id),
        }))
      );
      return { id: c.id, company: c.company, agents: enriched };
    })
  );

  return NextResponse.json({ clients: out });
}
