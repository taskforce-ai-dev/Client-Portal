import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/clientAuth";
import { getCurrentClientUser } from "@/lib/clientPermissions";
import { findClientById, isDbConfigured, setClientPassword, updateClient } from "@/lib/adminDb";
import { setClientUserPassword, updateClientUser } from "@/lib/clientUsers";
import { verifyPassword } from "@/lib/passwords";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in person's own account. "Legacy" = a pre-RBAC company login
// (no per-user row); their identity/credentials live on sentinel_client.
async function currentContext() {
  const session = getClientSession();
  if (!session) return null;
  const me = await getCurrentClientUser();
  if (!me) return null;
  return { session, me, isLegacy: session.userId === null };
}

function publicProfile(me: { id: string; email: string; name: string | null; is_admin: boolean; created_at: string; last_login_at: string | null }, company: string | null, isLegacy: boolean) {
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.is_admin ? (isLegacy ? "Owner" : "Admin") : "Member",
    isAdmin: me.is_admin,
    company,
    memberSince: me.created_at,
    lastLogin: me.last_login_at,
    isLegacy,
  };
}

// GET /api/me — the current user's own profile.
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const ctx = await currentContext();
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const company = (await findClientById(ctx.me.client_id))?.company ?? null;
  return NextResponse.json({ profile: publicProfile(ctx.me, company, ctx.isLegacy) });
}

// PATCH /api/me — update your OWN display name and/or password.
// Changing a password always requires the current password (a stolen session
// alone can't rotate credentials).
export async function PATCH(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ message: "Database not connected." }, { status: 503 });
  const ctx = await currentContext();
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: { name?: string | null; currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const { me, session, isLegacy } = ctx;

  // --- Password change (optional) ---
  if (body.newPassword !== undefined && body.newPassword !== "") {
    if (typeof body.newPassword !== "string" || body.newPassword.length < 8) {
      return NextResponse.json({ message: "New password must be at least 8 characters." }, { status: 400 });
    }
    if (!body.currentPassword) {
      return NextResponse.json({ message: "Enter your current password to change it." }, { status: 400 });
    }
    // Verify the current password against whichever store owns this login.
    const currentHash = isLegacy
      ? (await findClientById(session.clientId))?.password_hash
      : me.password_hash;
    if (!verifyPassword(body.currentPassword, currentHash)) {
      return NextResponse.json({ message: "Your current password is incorrect." }, { status: 403 });
    }
    const ok = isLegacy
      ? await setClientPassword(session.clientId, body.newPassword)
      : await setClientUserPassword(me.id, body.newPassword);
    if (!ok) return NextResponse.json({ message: "Couldn't update your password." }, { status: 500 });
  }

  // --- Display name (optional) ---
  if (body.name !== undefined) {
    const name = (body.name ?? "").toString().trim();
    if (isLegacy) {
      // Legacy company login has no personal name column — store it as the
      // account's contact person.
      await updateClient(session.clientId, { contact: name });
    } else {
      await updateClientUser(me.client_id, me.id, { name });
    }
  }

  // Return the refreshed profile.
  const refreshed = await getCurrentClientUser();
  const company = refreshed ? (await findClientById(refreshed.client_id))?.company ?? null : null;
  return NextResponse.json({
    ok: true,
    profile: refreshed ? publicProfile(refreshed, company, isLegacy) : null,
  });
}
