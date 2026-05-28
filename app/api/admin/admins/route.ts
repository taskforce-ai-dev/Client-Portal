import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No hardcoded data — returns empty until a datastore is connected.
export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json([]);
}
