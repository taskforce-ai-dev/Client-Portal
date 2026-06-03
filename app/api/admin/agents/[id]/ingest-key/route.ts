import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, regenerateAgentIngestKey } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ingestKey: agent.ingest_key || null });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const key = await regenerateAgentIngestKey(params.id);
  if (!key) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ingestKey: key });
}
