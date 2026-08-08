import { NextRequest, NextResponse } from "next/server";
import { CLIENT_COOKIE, CLIENT_MAX_AGE, createClientToken } from "@/lib/clientAuth";
import { findClientByEmail, isDbConfigured } from "@/lib/adminDb";
import { verifyPassword } from "@/lib/passwords";
import { clientIp, isLoginRateLimited, recordLoginFailure } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { message: "Login is not available yet — the database isn't connected." },
      { status: 503 }
    );
  }

  // Throttle credential stuffing before touching the DB for verification.
  const ip = clientIp(req);
  const rl = await isLoginRateLimited("client", ip);
  if (rl.limited) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const client = await findClientByEmail(body.email);
  if (!client || !verifyPassword(body.password, client.password_hash)) {
    await recordLoginFailure("client", ip);
    return NextResponse.json({ message: "Invalid email or password" }, { status: 401 });
  }
  // Allow-list: only "active" clients can sign in. Was deny-list before
  // ("blocked" / "suspended" only) — meant new statuses like "pending"
  // or admin-created clients with portal access disabled (status:
  // "blocked") would silently still grant access if the value drifted.
  if (client.status !== "active") {
    const msg = client.status === "pending"
      ? "Your account is pending approval. Contact your account manager."
      : client.status === "suspended"
        ? "Your account is temporarily suspended. Contact support."
        : "Portal access is disabled for this account. Contact support.";
    return NextResponse.json({ message: msg }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, company: client.company });
  res.cookies.set(CLIENT_COOKIE, createClientToken(client.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLIENT_MAX_AGE,
  });
  return res;
}
