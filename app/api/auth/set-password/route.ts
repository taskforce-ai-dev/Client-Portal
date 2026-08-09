import { NextRequest, NextResponse } from "next/server";
import { consumeClientInviteToken, isDbConfigured } from "@/lib/adminDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The one named exception carved out of app/api/auth: consumes a
// single-use set-password token and writes the client's own chosen
// password via lib/adminDb's setClientPassword (which itself calls the
// frozen lib/passwords.ts exports). No password is ever emailed or shown
// to an admin — this is the only place a client's real password is set.
export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token) {
    return NextResponse.json({ message: "Missing token" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ message: "Not available — the database isn't connected." }, { status: 503 });
  }

  const result = await consumeClientInviteToken(token, password);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : result.reason === "used" ? 409 : 400;
    const message =
      result.reason === "expired"
        ? "This link has expired. Ask your admin to resend the invite."
        : result.reason === "used"
          ? "This link has already been used. Ask your admin to resend the invite."
          : "This link is invalid.";
    return NextResponse.json({ message, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
