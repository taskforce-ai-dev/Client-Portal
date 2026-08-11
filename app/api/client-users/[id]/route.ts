import { NextRequest, NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/clientPermissions";
import { countActiveAdmins, findClientUserById, updateClientUser, type ClientUser } from "@/lib/clientUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["active", "invited", "disabled"]);

function publicUser(u: ClientUser) {
  const { password_hash, ...rest } = u;
  void password_hash;
  return rest;
}

// PATCH /api/client-users/:id — update a user in the caller's company.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;

  const target = await findClientUserById(params.id);
  // Tenant scoping: the target must be in the admin's own company.
  if (!target || target.client_id !== guard.user.client_id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  let body: { name?: string | null; isAdmin?: boolean; allowedFeatures?: string[]; status?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUS.has(body.status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }
  if (body.password !== undefined && typeof body.password === "string" && body.password.length > 0 && body.password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Don't let the company lose its last admin (demote or disable).
  const willLoseAdmin =
    (body.isAdmin === false && target.is_admin) ||
    (body.status === "disabled" && target.is_admin);
  if (willLoseAdmin && (await countActiveAdmins(guard.user.client_id)) <= 1) {
    return NextResponse.json(
      { message: "You can't remove the last admin. Make someone else an admin first." },
      { status: 400 }
    );
  }

  const updated = await updateClientUser(guard.user.client_id, params.id, {
    name: body.name,
    isAdmin: typeof body.isAdmin === "boolean" ? body.isAdmin : undefined,
    allowedFeatures: Array.isArray(body.allowedFeatures) ? body.allowedFeatures : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    password: typeof body.password === "string" && body.password ? body.password : undefined,
  });
  if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ user: publicUser(updated) });
}

// DELETE /api/client-users/:id — disable (soft) a user in the caller's company.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;

  const target = await findClientUserById(params.id);
  if (!target || target.client_id !== guard.user.client_id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (target.is_admin && (await countActiveAdmins(guard.user.client_id)) <= 1) {
    return NextResponse.json({ message: "You can't disable the last admin." }, { status: 400 });
  }
  await updateClientUser(guard.user.client_id, params.id, { status: "disabled" });
  return NextResponse.json({ ok: true });
}
