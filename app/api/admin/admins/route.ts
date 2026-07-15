import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { createAdmin, isDbConfigured, listAdmins } from "@/lib/adminDb";
import { sendAdminInviteEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json([]);
  const admins = await listAdmins();
  return NextResponse.json(
    admins.map((a) => ({ id: a.id, name: a.name, email: a.email, created_at: a.created_at }))
  );
}

export async function POST(req: NextRequest) {
  if (!isAuthed()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  let body: { name?: string; email?: string; password?: string; sendInvite?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ message: "Enter a valid email address" }, { status: 400 });
  }
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
  }
  try {
    const admin = await createAdmin({ name: body.name, email, password: body.password });
    let emailSent = false;
    if (body.sendInvite !== false) {
      const loginUrl = new URL("/admin/login", process.env.ADMIN_PORTAL_URL || req.nextUrl.origin).toString();
      const { sent, error } = await sendAdminInviteEmail({
        email: admin.email,
        name: admin.name,
        password: body.password,
        loginUrl,
      });
      if (!sent) console.error("Admin invite email not sent:", error);
      emailSent = sent;
    }
    return NextResponse.json({
      ok: true,
      admin: { id: admin.id, email: admin.email, name: admin.name },
      emailSent,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = /unique|duplicate/i.test(msg) ? 409 : 500;
    return NextResponse.json(
      { message: status === 409 ? "An admin with that email already exists" : msg },
      { status }
    );
  }
}
