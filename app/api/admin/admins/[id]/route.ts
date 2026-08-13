import { NextRequest, NextResponse } from "next/server";
import { getAdminSubject, isAuthed } from "@/lib/adminAuth";
import { deleteAdmin, findAdminById, isDbConfigured, updateAdminName } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-service profile edit — an admin may only rename their own account
// (not any other admin's), so this doesn't open up new cross-admin editing
// beyond what the Admin Users page already supports.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });

  const target = await findAdminById(params.id);
  if (!target) return NextResponse.json({ message: "Admin not found" }, { status: 404 });

  const subject = getAdminSubject();
  if (!subject || subject !== target.email) {
    return NextResponse.json({ message: "You can only edit your own profile" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

  const ok = await updateAdminName(params.id, name);
  if (!ok) return NextResponse.json({ message: "Admin not found" }, { status: 404 });
  return NextResponse.json({ ok: true, name });
}

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
