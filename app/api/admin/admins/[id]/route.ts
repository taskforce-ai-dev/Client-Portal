import { NextRequest, NextResponse } from "next/server";
import { getAdminSubject, isAuthed } from "@/lib/adminAuth";
import { deleteAdmin, findAdminById, isDbConfigured } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const target = await findAdminById(params.id);
  if (!target) return NextResponse.json({ message: "Admin not found" }, { status: 404 });

  // Prevent revoking yourself.
  const subject = getAdminSubject();
  if (subject && subject === target.email) {
    return NextResponse.json({ message: "You can't revoke your own admin account" }, { status: 400 });
  }

  const res = await deleteAdmin(params.id);
  if (!res.ok) {
    if (res.reason === "last_admin") {
      return NextResponse.json({ message: "Can't revoke the last admin — invite another first" }, { status: 400 });
    }
    return NextResponse.json({ message: "Admin not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
