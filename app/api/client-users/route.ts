import { NextRequest, NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/clientPermissions";
import { createClientUser, listClientUsers, type ClientUser } from "@/lib/clientUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Never serialize the password hash to the browser.
function publicUser(u: ClientUser) {
  const { password_hash, ...rest } = u;
  void password_hash;
  return rest;
}

// GET /api/client-users — list users in the caller's company (admin only).
export async function GET() {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;
  const users = await listClientUsers(guard.user.client_id);
  return NextResponse.json({ users: users.map(publicUser) });
}

// POST /api/client-users — create a user in the caller's company (admin only).
// client_id is ALWAYS taken from the admin's session, never the request body —
// so an admin can only ever create users inside their own company.
export async function POST(req: NextRequest) {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;

  let body: { email?: string; name?: string; password?: string; isAdmin?: boolean; allowedFeatures?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 });
  if (body.password !== undefined && typeof body.password === "string" && body.password.length > 0 && body.password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
  }

  const result = await createClientUser({
    clientId: guard.user.client_id,
    email,
    name: typeof body.name === "string" ? body.name : null,
    password: typeof body.password === "string" && body.password ? body.password : undefined,
    isAdmin: !!body.isAdmin,
    allowedFeatures: Array.isArray(body.allowedFeatures) ? body.allowedFeatures : [],
    createdBy: guard.user.id,
  });

  if (!result.ok) {
    return result.reason === "duplicate"
      ? NextResponse.json({ message: "A user with that email already exists." }, { status: 409 })
      : NextResponse.json({ message: "Invalid input — check the email and password." }, { status: 400 });
  }
  return NextResponse.json({ user: publicUser(result.user) });
}
