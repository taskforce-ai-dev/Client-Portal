import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { sentinelBundle } from "@/lib/sentinelDemo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(sentinelBundle());
}
