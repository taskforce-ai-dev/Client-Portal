import { NextRequest, NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/clientPermissions";
import { setClientLogo } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~370KB image once base64-encoded. Logos should be small; this keeps the row
// (and every page that reads the client) from bloating.
const MAX_LEN = 500_000;
// Only image data URLs. SVG is allowed because we only ever render the logo via
// <img src>, which does not execute scripts embedded in an SVG.
const DATA_URL = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

// POST /api/client/logo — set the caller's company logo (admin only).
// The logo is always stored on the admin's OWN client (from the session),
// never a client id from the request body.
export async function POST(req: NextRequest) {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;

  let body: { logoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
  if (!logoUrl) return NextResponse.json({ message: "No logo provided" }, { status: 400 });
  if (logoUrl.length > MAX_LEN) {
    return NextResponse.json({ message: "That image is too large. Please use one under ~350 KB." }, { status: 413 });
  }
  if (!DATA_URL.test(logoUrl)) {
    return NextResponse.json({ message: "Unsupported image. Use a PNG, JPG, WEBP, GIF, or SVG." }, { status: 400 });
  }

  const updated = await setClientLogo(guard.user.client_id, logoUrl);
  if (!updated) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, logoUrl: updated.logo_url });
}

// DELETE /api/client/logo — remove the caller's company logo (admin only).
export async function DELETE() {
  const guard = await requireClientAdmin();
  if (guard.error) return guard.error;
  await setClientLogo(guard.user.client_id, null);
  return NextResponse.json({ ok: true });
}
