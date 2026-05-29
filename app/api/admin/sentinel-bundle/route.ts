import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getSentinelBundle } from "@/lib/sentinel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const bundle = await getSentinelBundle();
  return NextResponse.json(bundle);
}
