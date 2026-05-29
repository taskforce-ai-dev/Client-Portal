import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { isDbConfigured, revealClientPassword, setClientPassword } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reveal the client's current portal password (decrypted server-side).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const password = await revealClientPassword(params.id);
  if (password == null) return NextResponse.json({ message: "Not available" }, { status: 404 });
  return NextResponse.json({ password });
}

// Reset the client's portal password to a new value.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.password || body.password.length < 6) {
    return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
  }
  const ok = await setClientPassword(params.id, body.password);
  if (!ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
