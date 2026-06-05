import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { isDbConfigured, revealAgentApiKeys } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const keys = await revealAgentApiKeys(params.id);
  if (!keys) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(keys);
}
