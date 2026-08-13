import { NextResponse } from "next/server";
import { getAdminSubject } from "@/lib/adminAuth";
import { findAdminByEmail, isDbConfigured } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The env-bootstrap admin has no DB row (and no proper name), so derive a
// readable display name from the local part of its email.
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()) || email;
}

export async function GET() {
  const email = getAdminSubject();
  if (!email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let id: string | null = null;
  let name = displayNameFromEmail(email);
  let createdAt: string | null = null;
  let editable = false;

  if (isDbConfigured()) {
    const admin = await findAdminByEmail(email);
    if (admin) {
      id = admin.id;
      name = admin.name || name;
      createdAt = admin.created_at;
      editable = true;
    }
  }

  return NextResponse.json({
    id,
    name,
    email,
    role: "Super Admin",
    initials: initials(name),
    createdAt,
    // Only DB-backed admins can edit their profile / change their password —
    // the env-bootstrap admin (no DB row) is managed via environment config.
    editable,
  });
}
