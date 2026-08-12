import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { findClientById, isDbConfigured, issueClientOwnerInvite } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issues a single-use, 24h set-password link and emails it via Resend, to
// the client's owner sentinel_client_user (created on demand for any client
// that predates the RBAC migration). Same endpoint for a first-time invite,
// an admin-triggered "Resend invite", and "Reset password" from the client
// detail view — all three just (re)issue a fresh token via the same shared
// helper used by client creation's "send welcome email" option.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const client = await findClientById(params.id);
  if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

  try {
    const { sent, expiresAt } = await issueClientOwnerInvite(client.id, req.nextUrl.origin);
    return NextResponse.json({ ok: true, emailSent: sent, expiresAt });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
