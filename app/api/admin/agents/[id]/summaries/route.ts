import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findAgentById, isDbConfigured, listCallSummaries } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ summaries: [] });
  const agent = await findAgentById(params.id);
  if (!agent) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 1000);
  const summaries = await listCallSummaries(agent.id, { limit });
  return NextResponse.json({ summaries });
}
