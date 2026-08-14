import { NextRequest, NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/clientPermissions";
import { setClientCompany } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/client/business — update the caller's own business (company) name.
// Admin only; the client id always comes from the session, never the body.
export async function PATCH(req: NextRequest) {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;

  let body: { company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const company = typeof body.company === "string" ? body.company.trim() : "";
  if (!company) return NextResponse.json({ message: "Business name is required." }, { status: 400 });
  if (company.length > 120) return NextResponse.json({ message: "Business name is too long (max 120 characters)." }, { status: 400 });

  const updated = await setClientCompany(guard.user.client_id, company);
  if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, company: updated.company });
}
