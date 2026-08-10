import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { createClientInviteToken, findClientById, isDbConfigured } from "@/lib/adminDb";
import { sendClientInviteEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues a single-use, 24h set-password link and emails it via Resend.
// Same endpoint for a first-time invite and an admin-triggered "Resend
// invite" (password reset) — both just (re)issue a fresh token.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const client = await findClientById(params.id);
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  try {
    const { token, expiresAt } = await createClientInviteToken(client.id);
    const base = process.env.CLIENT_PORTAL_URL || req.nextUrl.origin;
    const setPasswordUrl = new URL(`/set-password?token=${token}`, base).toString();

    const { sent, error } = await sendClientInviteEmail({
      email: client.email,
      company: client.company,
      setPasswordUrl,
      expiresAt,
    });
    if (!sent) console.error("Client invite email not sent:", error);

    return NextResponse.json({ ok: true, emailSent: sent, expiresAt });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
